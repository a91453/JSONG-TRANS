/**
 * POST /api/analyze-stream
 *
 * SSE 流式字幕分析端點。
 * 依序執行與 analyze-video.ts 相同的管線，但以「每批 15 段」的方式流式輸出，
 * 讓使用者在 ~2s 後即可看到第一批字幕，無需等待全部分析完成。
 *
 * SSE 事件格式：
 *   event: stage       data: { text: string }
 *   event: need_google_auth   data: {}
 */

// Vercel 函式逾時：60s 是 Hobby 與 Pro 共同安全上限
// （Cloud Run Whisper ~3 min 會超時，但 YT 字幕 + LrcLib + AI 批注通常在 40s 內完成）
export const maxDuration = 60;

// event: batch       data: { segments: Segment[], batchIndex: number, totalBatches: number }
// event: done        data: { source: string, totalSegments: number, duration: number, videoId: string }
// event: error       data: { message: string }

import { getSmartSubtitles } from '@/lib/youtube-actions';
import { groqGenerate }       from '@/lib/groq-generate';
import { createAi, z }        from '@/ai/genkit';
import { transcribeYouTubeWithWhisper } from '@/lib/groq-whisper';

// ── 型別 ──────────────────────────────────────────────────────────────────────

const FuriganaItemSchema = z.object({
  word:    z.string(),
  reading: z.string(),
});

const SegmentSchema = z.object({
  id:          z.string(),
  start:       z.number(),
  end:         z.number(),
  japanese:    z.string(),
  translation: z.string(),
  furigana:    z.array(FuriganaItemSchema),
});

type RawSeg = { start: number; end: number; text: string };

// ── 工具函式 ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 15;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toTimestamp(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const ANNOTATED_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"annotatedSegments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

const SEGMENTS_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"segments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

// ── AI 標注（單批次）─────────────────────────────────────────────────────────

async function annotateBatch(
  batch: RawSeg[],
  videoTitle: string,
  sourceLabel: string,
  provider: 'google' | 'groq',
  apiKey: string,
  model: string
): Promise<z.infer<typeof SegmentSchema>[]> {
  const lines = batch
    .map(c => `[${toTimestamp(c.start)}-${toTimestamp(c.end)}] ${c.text}`)
    .join('\n');

  const prompt = `你是一位日語語言學專家。以下是歌曲「${videoTitle}」的${sourceLabel}歌詞片段：

${lines}

請嚴格按照時間戳與文字，為每一段進行以下處理：

【振假名標注規則】
1. 漢字及其連動的活用語尾必須視為一個「單一 word」：
   - 正確：word:"去られ", reading:"さられ"
   - 正確：word:"笑った", reading:"わらった"
   - 嚴禁拆分（不可將"去"與"られ"分開）。
2. 日文原文中每一個漢字都必須在 furigana 陣列中有對應項目。
3. reading 必須是純平假名。

【翻譯規則】
- 繁體中文翻譯，保持詩意與語境。
- 保留原始 start/end 時間戳，id 填入空字串。`;

  if (provider === 'groq') {
    const raw  = await groqGenerate(apiKey, model, [
      { role: 'system', content: '你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。' },
      { role: 'user',   content: prompt + '\n\n' + ANNOTATED_HINT },
    ]);
    const json = JSON.parse(raw);
    return z.object({ annotatedSegments: z.array(SegmentSchema) }).parse(json).annotatedSegments;
  }

  const ai = createAi(provider, apiKey);
  const { output } = await ai.generate({
    model,
    output: { schema: z.object({ annotatedSegments: z.array(SegmentSchema) }) },
    prompt,
  });
  if (!output?.annotatedSegments) throw new Error('AI 標注失敗');
  return output.annotatedSegments;
}

// ── AI 完整生成（無字幕來源時） ───────────────────────────────────────────────

async function generateFull(
  videoId: string,
  videoTitle: string,
  provider: 'google' | 'groq',
  apiKey: string,
  model: string
): Promise<z.infer<typeof SegmentSchema>[]> {
  const prompt = `你是一位日語語言學專家。請解析 YouTube 影片 ID: ${videoId}（標題：${videoTitle}）的完整歌詞內容。

請生成逐字幕，每段包含開始/結束時間（秒）、日文原文、振假名、繁體中文翻譯。

【振假名標注規則】
1. 漢字與活用語尾視為一個 word（去られ→さられ、笑った→わらった）。
2. 每個漢字都必須有對應的 furigana 項目。
3. reading 為純平假名。
4. id 欄位填入空字串。`;

  if (provider === 'groq') {
    const raw  = await groqGenerate(apiKey, model, [
      { role: 'system', content: '你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。' },
      { role: 'user',   content: prompt + '\n\n' + SEGMENTS_HINT },
    ]);
    const json = JSON.parse(raw);
    return z.object({ segments: z.array(SegmentSchema) }).parse(json).segments;
  }

  const ai = createAi(provider, apiKey);
  const { output } = await ai.generate({
    model,
    output: { schema: z.object({ segments: z.array(SegmentSchema) }) },
    prompt,
  });
  if (!output?.segments) throw new Error('AI 生成失敗');
  return output.segments;
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const {
    videoId,
    videoTitle    = '',
    forceRefresh  = false,
    groqApiKeyForWhisper,
    googleToken,
    config        = {},
  } = await req.json();

  const provider: 'google' | 'groq' = config.provider ?? 'google';
  const apiKey: string               = config.apiKey   ?? '';
  const model:  string               = config.model    ??
    (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');

  if (!apiKey) {
    return Response.json({ error: 'Missing API key' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(sseChunk(event, data));

      try {
        const isYouTube = typeof videoId === 'string' && videoId.length === 11;

        // ── 1. SmartSubtitles（快取守門員）────────────────────────────────
        send('stage', { text: '正在比對 YouTube 字幕…' });

        type Source = 'lrclib' | 'server-sub' | 'server-sub-auto' | 'whisper-groq' | 'genkit-ai';
        let subtitleResult  = null;
        let expectedSource: Source;
        let rawSegments:  RawSeg[]  = [];
        let sourceLabel:  string    = '';
        let titleForPrompt          = videoTitle || '未知';
        let isFullGenerate          = false;

        if (isYouTube) {
          try {
            subtitleResult = await getSmartSubtitles(
              videoId, videoTitle, forceRefresh, googleToken
            );
          } catch (e: any) {
            if (e.message === 'YOUTUBE_AUTH_REQUIRED') {
              // 僅在尚未提供 token 時才要求登入；有 token 卻還失敗則繼續降級
              if (!googleToken) {
                send('need_google_auth', {});
                controller.close();
                return;
              }
              // token 無效 → 繼續降級流程，subtitleResult 保持 null
            }
            // 其他例外：繼續降級
          }
        }

        // ── 2. 決定來源與原始片段 ─────────────────────────────────────────
        if (subtitleResult && subtitleResult.segments.length >= 3) {
          const srcMap: Record<string, Source> = {
            'youtube-official': 'server-sub',
            'youtube-auto':     'server-sub-auto',
            'lrclib':           'lrclib',
            'external':         'server-sub',
          };
          expectedSource = srcMap[subtitleResult.source] ?? 'server-sub';
          rawSegments    = subtitleResult.segments;
          sourceLabel    = subtitleResult.source === 'lrclib'      ? 'LrcLib 同步'
                         : subtitleResult.source === 'external'    ? '外部語音服務'
                         : subtitleResult.source === 'youtube-auto' ? '自動生成' : '官方';
          if (subtitleResult.lrcArtistName && subtitleResult.lrcTrackName) {
            titleForPrompt = `${subtitleResult.lrcArtistName} - ${subtitleResult.lrcTrackName}`;
          }
        } else {
          // SmartSubtitles 全部失敗 → Groq Whisper → AI 完整生成
          const groqKeyForWhisper =
            (provider === 'groq' ? apiKey : null) ??
            (groqApiKeyForWhisper as string | undefined)?.trim() ?? null;

          if (groqKeyForWhisper && isYouTube) {
            send('stage', { text: '正在進行 Whisper 語音聽寫…' });
            const whisperSegs = await transcribeYouTubeWithWhisper(
              videoId, groqKeyForWhisper
            ).catch(() => null);

            if (whisperSegs && whisperSegs.length >= 3) {
              expectedSource = 'whisper-groq';
              rawSegments    = whisperSegs;
              sourceLabel    = 'Whisper 語音聽寫';
            } else {
              expectedSource = 'genkit-ai';
              isFullGenerate = true;
            }
          } else {
            expectedSource = 'genkit-ai';
            isFullGenerate = true;
          }
        }

        // ── 3. AI 標注（分批流式） ────────────────────────────────────────
        send('stage', { text: '正在解析日文語法 📝' });

        const allAnnotated: z.infer<typeof SegmentSchema>[] = [];

        if (isFullGenerate) {
          // 完整 AI 生成：一次呼叫，單批輸出
          const segs    = await generateFull(videoId, titleForPrompt, provider, apiKey, model);
          const withIds = segs.map(s => ({ ...s, id: crypto.randomUUID() }));
          send('batch', { segments: withIds, batchIndex: 0, totalBatches: 1 });
          allAnnotated.push(...withIds);
        } else {
          // 逐批標注：每批 15 段，批次完成即推送
          const batches     = chunk(rawSegments, BATCH_SIZE);
          const totalBatches = batches.length;

          for (let i = 0; i < batches.length; i++) {
            send('stage', { text: `正在標注第 ${i + 1} / ${totalBatches} 批…` });
            const annotated = await annotateBatch(
              batches[i], titleForPrompt, sourceLabel, provider, apiKey, model
            );
            const withIds = annotated.map(s => ({ ...s, id: crypto.randomUUID() }));
            send('batch', { segments: withIds, batchIndex: i, totalBatches });
            allAnnotated.push(...withIds);
          }
        }

        // ── 4. 完成 ───────────────────────────────────────────────────────
        send('done', {
          source:        expectedSource,
          totalSegments: allAnnotated.length,
          duration:      allAnnotated[allAnnotated.length - 1]?.end ?? 0,
          videoId,
        });

      } catch (e: any) {
        send('error', { message: e.message || '分析失敗，請稍後再試。' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache',
      'Connection':      'keep-alive',
      'X-Accel-Buffering': 'no', // 關閉 Nginx 緩衝，確保逐事件即時推送
    },
  });
}
