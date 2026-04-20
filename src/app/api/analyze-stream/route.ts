/**
 * POST /api/analyze-stream
 *
 * SSE 流式字幕分析端點。
 * 標注邏輯統一委派給 src/ai/nodes/annotateNode.ts，
 * Prompt 模板從 Firestore config/prompts 動態讀取（見 src/ai/prompt-store.ts）。
 *
 * SSE 事件格式：
 *   event: stage          data: { text: string }
 *   event: need_google_auth data: {}
 *   event: batch          data: { segments: Segment[], batchIndex: number, totalBatches: number }
 *   event: done           data: { source: string, totalSegments: number, duration: number, videoId: string }
 *   event: error          data: { message: string }
 */

export const maxDuration = 60;

import { getSmartSubtitles } from '@/lib/youtube-actions';
import { annotateBatch, translateBatch, generateFull, type RawSeg } from '@/ai/nodes/annotateNode';

const BATCH_SIZE  = 15;
// 免費版 Gemini 每分鐘限 5 次；2 個 worker 加上 withRetry 等待可穩定消化
const CONCURRENCY = 2;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

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
      let closed = false;
      const closeOnce = () => { if (!closed) { closed = true; controller.close(); } };
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(sseChunk(event, data));
      };

      try {
        const isYouTube = typeof videoId === 'string' && videoId.length === 11;

        // ── 1. SmartSubtitles ──────────────────────────────────────────────
        const groqKeyForWhisper =
          (provider === 'groq' ? apiKey : null) ??
          (groqApiKeyForWhisper as string | undefined)?.trim() ?? null;

        send('stage', { text: '正在比對 YouTube 字幕…' });

        type Source = 'lrclib' | 'server-sub' | 'server-sub-auto' | 'whisper-groq' | 'genkit-ai';
        let subtitleResult  = null;
        let expectedSource: Source;
        let rawSegments: RawSeg[]  = [];
        let sourceLabel:  string   = '';
        let titleForPrompt         = videoTitle || '未知';
        let isFullGenerate         = false;

        if (isYouTube) {
          try {
            subtitleResult = await getSmartSubtitles(
              videoId, videoTitle, forceRefresh,
              googleToken,
              groqKeyForWhisper ?? undefined
            );
          } catch (e: any) {
            if (e.message === 'YOUTUBE_AUTH_REQUIRED' && !googleToken) {
              send('need_google_auth', {});
              closeOnce();
              return;
            }
          }
        }

        // ── 2. 決定來源 ────────────────────────────────────────────────────
        if (subtitleResult && subtitleResult.segments.length >= 3) {
          const srcMap: Record<string, Source> = {
            'whisper-groq':     'whisper-groq',
            'youtube-official': 'server-sub',
            'youtube-auto':     'server-sub-auto',
            'lrclib':           'lrclib',
            'external':         'server-sub',
            'manual':           'server-sub',
          };
          expectedSource = srcMap[subtitleResult.source] ?? 'server-sub';
          rawSegments    = subtitleResult.segments;
          sourceLabel    = subtitleResult.source === 'whisper-groq' ? 'Whisper 語音聽寫'
                         : subtitleResult.source === 'lrclib'       ? 'LrcLib 同步'
                         : subtitleResult.source === 'external'     ? '外部語音服務'
                         : subtitleResult.source === 'manual'       ? '手動上傳'
                         : subtitleResult.source === 'youtube-auto' ? '自動生成' : '官方';
          if (subtitleResult.lrcArtistName && subtitleResult.lrcTrackName) {
            titleForPrompt = `${subtitleResult.lrcArtistName} - ${subtitleResult.lrcTrackName}`;
          }
        } else {
          expectedSource = 'genkit-ai';
          isFullGenerate = true;
        }

        // ── 3. AI 標注（委派給 annotateNode，並行 worker pool）─────────────
        send('stage', { text: '正在解析日文語法 📝' });

        const allAnnotated: { start: number; end: number; [k: string]: any }[] = [];

        if (isFullGenerate) {
          const segs    = await generateFull(videoId, titleForPrompt, provider, apiKey, model);
          const withIds = segs.map(s => ({ ...s, id: crypto.randomUUID() }));
          send('batch', { segments: withIds, batchIndex: 0, totalBatches: 1 });
          allAnnotated.push(...withIds);
        } else {
          // 若來源已預先標注振假名（例如 Cloud Run 轉錄），只需 AI 翻譯
          const hasPreAnnotatedFurigana =
            rawSegments.length > 0 &&
            Array.isArray(rawSegments[0].furigana) &&
            rawSegments[0].furigana.length > 0;

          const batches      = chunk(rawSegments, BATCH_SIZE);
          const totalBatches = batches.length;
          const taskLabel    = hasPreAnnotatedFurigana ? '翻譯' : '標注';
          if (hasPreAnnotatedFurigana) {
            send('stage', { text: '振假名已預先標注，僅需翻譯 ⚡' });
          }
          send('stage', { text: `並行${taskLabel} ${totalBatches} 批（同時 ${Math.min(CONCURRENCY, totalBatches)} 批）…` });

          let completed  = 0;
          let failed     = 0;
          let nextIdx    = 0;

          async function worker() {
            while (nextIdx < batches.length) {
              const i = nextIdx++;
              try {
                const runner = hasPreAnnotatedFurigana ? translateBatch : annotateBatch;
                const annotated = await runner(
                  batches[i], titleForPrompt, sourceLabel, provider, apiKey, model
                );
                const withIds = annotated.map(s => ({ ...s, id: crypto.randomUUID() }));
                send('batch', { segments: withIds, batchIndex: i, totalBatches });
                allAnnotated.push(...withIds);
                send('stage', { text: `已完成 ${++completed} / ${totalBatches} 批` });
              } catch (err: any) {
                failed++;
                send('stage', { text: `第 ${i + 1} 批失敗：${err?.message || '未知錯誤'}` });
              }
            }
          }

          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

          if (allAnnotated.length === 0) {
            throw new Error('所有批次標注均失敗，請檢查 API Key 或稍後再試。');
          }

          allAnnotated.sort((a, b) => a.start - b.start);
        }

        // ── 4. 完成 ────────────────────────────────────────────────────────
        send('done', {
          source:        expectedSource,
          totalSegments: allAnnotated.length,
          duration:      allAnnotated[allAnnotated.length - 1]?.end ?? 0,
          videoId,
        });

      } catch (e: any) {
        send('error', { message: e.message || '分析失敗，請稍後再試。' });
      } finally {
        closeOnce();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
