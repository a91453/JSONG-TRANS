
'use server';
/**
 * @fileOverview 影片解析 AI 流程
 *
 * 字幕來源優先順序（精準度高 → 低）：
 *   1. YouTube timedtext  — 人工/自動字幕（時間軸 100% 精準，首選）
 *   2. LrcLib.net         — 同步歌詞庫（快速，但 MV 可能有前奏偏移）
 *   3. Groq Whisper       — 語音聽寫（完美時間軸，僅限 Groq 使用者）
 *   4. AI 完整生成        — 最後手段，AI 自行推算時間軸
 *
 * 無論來源為何，最終都透過同一 AI 補上振假名 + 繁中翻譯。
 */

import { createAi, z } from '@/ai/genkit';
import { getSmartSubtitles } from '@/lib/youtube-actions';
import { groqGenerate } from '@/lib/groq-generate';
import { transcribeYouTubeWithWhisper } from '@/lib/groq-whisper';

const FuriganaItemSchema = z.object({
  word: z.string().describe('包含漢字的完整語義單元（含活用語尾，如：去られ、笑った）'),
  reading: z.string().describe('該單元的完整平假名讀音'),
});

const SegmentSchema = z.object({
  id: z.string(),
  start: z.number().describe('開始時間（秒）'),
  end: z.number().describe('結束時間（秒）'),
  japanese: z.string().describe('日文原文'),
  translation: z.string().describe('繁體中文翻譯'),
  furigana: z.array(FuriganaItemSchema).describe('所有漢字單元的讀音'),
});

const AnalyzeVideoInputSchema = z.object({
  videoId: z.string(),
  videoTitle: z.string().optional(),
  /** true = 跳過 Firestore 快取，強制重新抓取 */
  forceRefresh: z.boolean().optional(),
  /**
   * 專供 Whisper 語音聽寫使用的 Groq API Key。
   * 允許 Gemini 使用者也能啟用 Whisper 降級（主要 AI 仍走 Gemini）。
   */
  groqApiKeyForWhisper: z.string().optional(),
  config: z.object({
    provider: z.enum(['google', 'groq']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
});

function toTimestamp(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function is503(msg: string, code?: number): boolean {
  return (
    code === 503 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('Service Unavailable') ||
    msg.includes('high demand')
  );
}

async function generateWithRetry(
  ai: Awaited<ReturnType<typeof import('@/ai/genkit').createAi>>,
  options: Parameters<typeof ai.generate>[0],
  maxRetries = 2
): Promise<Awaited<ReturnType<typeof ai.generate>>> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.generate(options);
    } catch (err: any) {
      if (is503(err.message || '', err.code) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 4000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('重試次數已耗盡');
}

// ── JSON hints for Groq structured output ───────────────────────────────────
const SEGMENTS_JSON_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"segments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

const ANNOTATED_JSON_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"annotatedSegments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

function parseGroqSegments(raw: string): z.infer<typeof SegmentSchema>[] {
  let json: any;
  try { json = JSON.parse(raw); } catch { throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。'); }
  const r = z.object({ segments: z.array(SegmentSchema) }).safeParse(json);
  if (!r.success) throw new Error('Groq 輸出格式不符合預期，請稍後再試。');
  return r.data.segments;
}

function parseGroqAnnotated(raw: string): z.infer<typeof SegmentSchema>[] {
  let json: any;
  try { json = JSON.parse(raw); } catch { throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。'); }
  const r = z.object({ annotatedSegments: z.array(SegmentSchema) }).safeParse(json);
  if (!r.success) throw new Error('Groq 輸出格式不符合預期，請稍後再試。');
  return r.data.annotatedSegments;
}

// ── 共用標注 prompt 產生器 ───────────────────────────────────────────────────
function buildAnnotationPrompt(
  lines: Array<{ start: number; end: number; text: string }>,
  videoTitle: string,
  sourceLabel: string
): string {
  const captionLines = lines
    .map(c => `[${toTimestamp(c.start)}-${toTimestamp(c.end)}] ${c.text}`)
    .join('\n');

  return `你是一位日語語言學專家。以下是歌曲「${videoTitle}」的${sourceLabel}歌詞：

${captionLines}

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
}

function buildFullGeneratePrompt(videoId: string, videoTitle: string): string {
  return `你是一位日語語言學專家。請解析 YouTube 影片 ID: ${videoId}（標題：${videoTitle}）的完整歌詞內容。

請生成逐字幕，每段包含開始/結束時間（秒）、日文原文、振假名、繁體中文翻譯。

【振假名標注規則】
1. 漢字與活用語尾視為一個 word（去られ→さられ、笑った→わらった）。
2. 每個漢字都必須有對應的 furigana 項目。
3. reading 為純平假名。
4. id 欄位填入空字串。`;
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
export async function analyzeVideoAction(input: z.infer<typeof AnalyzeVideoInputSchema>) {
  const provider = input.config?.provider || 'google';
  const userApiKey = input.config?.apiKey;

  if (!userApiKey) {
    throw new Error(`請先前往「設定」頁面設定您的 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key。`);
  }

  try {
    const modelId = input.config?.model
      || (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');
    const videoTitle = input.videoTitle || '未知';
    const isYouTube = input.videoId.length === 11;

    // ── 步驟 1：SmartSubtitles（快取守門員）────────────────────────────
    // Firestore 快取 → YouTube 字幕 → LrcLib → 外部服務
    const subtitleResult = isYouTube
      ? await getSmartSubtitles(input.videoId, videoTitle, input.forceRefresh ?? false).catch(() => null)
      : null;

    // ── 步驟 2：決定來源 ─────────────────────────────────────────────────
    type Source = 'lrclib' | 'server-sub' | 'server-sub-auto' | 'whisper-groq' | 'genkit-ai';
    let expectedSource: Source;
    let prompt: string;

    if (subtitleResult && subtitleResult.segments.length >= 3) {
      // ── 優先 1-4：SmartSubtitles 成功（含快取、YouTube、LrcLib、外部服務）
      const srcMap: Record<string, Source> = {
        'youtube-official': 'server-sub',
        'youtube-auto':     'server-sub-auto',
        'lrclib':           'lrclib',
        'external':         'server-sub',
      };
      expectedSource = srcMap[subtitleResult.source] ?? 'server-sub';

      const sourceLabel = subtitleResult.source === 'lrclib'
        ? 'LrcLib 同步'
        : subtitleResult.source === 'external'
          ? '外部語音服務'
          : subtitleResult.source === 'youtube-auto' ? '自動生成' : '官方';

      const titleForPrompt = subtitleResult.lrcArtistName && subtitleResult.lrcTrackName
        ? `${subtitleResult.lrcArtistName} - ${subtitleResult.lrcTrackName}`
        : videoTitle;

      prompt = buildAnnotationPrompt(subtitleResult.segments, titleForPrompt, sourceLabel);
      console.log(`[Analyze] 來源: ${subtitleResult.source} (${subtitleResult.segments.length} 段)`);

    } else {
      // SmartSubtitles 全部失敗 ─────────────────────────────────────────
      // ── 優先 3：Groq Whisper（有 Groq Key 即可，與主要 AI 供應商無關）
      //    Groq 使用者：userApiKey 即 Groq Key
      //    Gemini 使用者：可在設定中選填 groqApiKeyForWhisper 啟用 Whisper
      const groqKeyForWhisper = (provider === 'groq' ? userApiKey : null)
        ?? input.groqApiKeyForWhisper?.trim() ?? null;

      if (groqKeyForWhisper && isYouTube) {
        console.log('[Analyze] 嘗試 Groq Whisper 語音聽寫...');
        const whisperSegments = await transcribeYouTubeWithWhisper(input.videoId, groqKeyForWhisper);

        if (whisperSegments && whisperSegments.length >= 3) {
          expectedSource = 'whisper-groq';
          prompt = buildAnnotationPrompt(whisperSegments, videoTitle, 'Whisper 語音聽寫');
          console.log(`[Analyze] Whisper 成功（${whisperSegments.length} 段）`);
        } else {
          console.log('[Analyze] Whisper 失敗，降級至 AI 完整生成');
          expectedSource = 'genkit-ai';
          prompt = buildFullGeneratePrompt(input.videoId, videoTitle);
        }
      } else {
        // ── 優先 4：AI 完整生成（無 Groq Key 或非 YouTube）──────────────
        expectedSource = 'genkit-ai';
        prompt = buildFullGeneratePrompt(input.videoId, videoTitle);
        console.log('[Analyze] 使用 AI 完整生成');
      }
    } // end outer else (SmartSubtitles 全部失敗)

    // ── 步驟 3：呼叫 AI 補上振假名 + 翻譯 ───────────────────────────────
    let finalSegments: z.infer<typeof SegmentSchema>[];

    if (provider === 'groq') {
      const isAnnotation = expectedSource !== 'genkit-ai';
      const hint = isAnnotation ? ANNOTATED_JSON_HINT : SEGMENTS_JSON_HINT;
      const raw = await groqGenerate(userApiKey, modelId, [
        { role: 'system', content: '你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。' },
        { role: 'user', content: prompt + '\n\n' + hint },
      ]);
      finalSegments = isAnnotation ? parseGroqAnnotated(raw) : parseGroqSegments(raw);
    } else {
      const ai = createAi(provider, userApiKey);
      const isAnnotation = expectedSource !== 'genkit-ai';
      const outputSchema = isAnnotation
        ? z.object({ annotatedSegments: z.array(SegmentSchema) })
        : z.object({ segments: z.array(SegmentSchema) });

      const { output } = await generateWithRetry(ai, {
        model: modelId,
        output: { schema: outputSchema },
        prompt,
      });

      if (!output) throw new Error('解析失敗，請檢查 API Key 或稍後再試。');
      finalSegments = (output as any).annotatedSegments ?? (output as any).segments;
      if (!finalSegments?.length) throw new Error('解析失敗，請檢查 API Key 或稍後再試。');
    }

    if (!finalSegments?.length) throw new Error('解析失敗，請檢查 API Key 或稍後再試。');

    return {
      videoId: input.videoId,
      duration: finalSegments[finalSegments.length - 1]?.end || 0,
      segments: finalSegments.map((s: any) => ({ ...s, id: crypto.randomUUID() })),
      source: expectedSource,
    };

  } catch (error: any) {
    console.error('Error in analyzeVideoAction:', error);
    const msg: string = error.message || '';
    const code: number = error.code || 0;
    if (is503(msg, code)) throw new Error('AI 服務目前流量過高，請稍候幾秒後重試。');
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) throw new Error('API 配額已滿，請稍候 30 秒再試。');
    if (msg.includes('403') || msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED')) throw new Error('API Key 無效或權限不足，請至設定頁面重新確認。');
    if (msg.includes('404') || msg.includes('NOT_FOUND')) throw new Error('找不到指定的 AI 模型，請至設定頁面更換模型。');
    throw new Error(msg || '分析失敗，請檢查網路或 API 設定後再試。');
  }
}

// ── 自定義段落標注 ───────────────────────────────────────────────────────────
export async function annotateSegmentsAction(
  segments: Array<{ start: number; end: number; text: string }>,
  config?: { provider?: 'google' | 'groq'; apiKey?: string; model?: string }
) {
  const provider = config?.provider || 'google';
  const userApiKey = config?.apiKey;
  if (!userApiKey) throw new Error(`請提供 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key。`);

  try {
    const modelId = config?.model
      || (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');
    const segmentLines = segments.map(s => `- [${s.start}s-${s.end}s] ${s.text}`).join('\n');

    const annotationPrompt = `請為以下段落進行日語標注與繁體中文翻譯。
【規則】漢字與活用語尾視為一個 word（去られ、笑った 等），reading 為純平假名。

${segmentLines}`;

    let finalSegments: z.infer<typeof SegmentSchema>[];

    if (provider === 'groq') {
      const raw = await groqGenerate(userApiKey, modelId, [
        { role: 'system', content: '你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。' },
        { role: 'user', content: annotationPrompt + '\n\n' + ANNOTATED_JSON_HINT },
      ]);
      finalSegments = parseGroqAnnotated(raw);
    } else {
      const ai = createAi(provider, userApiKey);
      const { output } = await ai.generate({
        model: modelId,
        output: { schema: z.object({ annotatedSegments: z.array(SegmentSchema) }) },
        prompt: annotationPrompt,
      });
      if (!output?.annotatedSegments) throw new Error('AI 標注失敗');
      finalSegments = output.annotatedSegments;
    }

    return {
      videoId: 'custom_' + Date.now(),
      duration: segments[segments.length - 1]?.end || 0,
      segments: finalSegments.map((s: any) => ({ ...s, id: crypto.randomUUID() })),
      source: 'genkit-ai' as const,
    };
  } catch (error: any) {
    console.error('Error in annotateSegmentsAction:', error);
    const msg: string = error.message || '';
    throw new Error(msg || 'AI 標注失敗，請檢查 API Key 或稍後再試。');
  }
}
