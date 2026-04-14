
'use server';
/**
 * @fileOverview 影片解析 AI 流程
 *
 * 字幕來源優先順序：
 *   1. LrcLib.net  — 同步歌詞庫（最準確時間軸，免 API Key）
 *   2. YouTube timedtext — 官方 / 自動字幕
 *   3. AI 完整生成  — 以上皆無時的最後手段
 *
 * AI 在 1/2 的情況下只需補假名 + 翻譯，速度大幅提升。
 */

import { createAi, z } from '@/ai/genkit';
import { fetchYouTubeCaptions } from '@/lib/youtube-captions';
import { searchLrcLib } from '@/lib/lrclib';
import { groqGenerate } from '@/lib/groq-generate';

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

    // ── 步驟 1：並行搜尋 LrcLib + YouTube 字幕 ──────────────────────────
    const [lrcResult, captionResult] = await Promise.all([
      isYouTube
        ? searchLrcLib(videoTitle).catch(() => null)
        : null,
      isYouTube
        ? fetchYouTubeCaptions(input.videoId).catch(() => null)
        : null,
    ]);

    // ── 步驟 2：決定來源與 prompt ────────────────────────────────────────
    type Source = 'lrclib' | 'server-sub' | 'server-sub-auto' | 'genkit-ai';
    let expectedSource: Source;
    let prompt: string;

    if (lrcResult && lrcResult.segments.length >= 3) {
      // ── 優先：LrcLib 同步歌詞 ──────────────────────────────────────
      expectedSource = 'lrclib';
      prompt = buildAnnotationPrompt(
        lrcResult.segments.map(s => ({ start: s.start, end: s.end, text: s.text })),
        `${lrcResult.track.artistName} - ${lrcResult.track.trackName}`,
        'LrcLib 同步'
      );
    } else if (captionResult && captionResult.captions.length >= 3) {
      // ── 次選：YouTube 字幕 ─────────────────────────────────────────
      expectedSource = captionResult.isAuto ? 'server-sub-auto' : 'server-sub';
      prompt = buildAnnotationPrompt(
        captionResult.captions.map(c => ({ start: c.start, end: c.end, text: c.text })),
        videoTitle,
        captionResult.isAuto ? '自動生成' : '官方'
      );
    } else {
      // ── 最後手段：AI 完整生成 ──────────────────────────────────────
      expectedSource = 'genkit-ai';
      prompt = `你是一位日語語言學專家。請解析 YouTube 影片 ID: ${input.videoId}（標題：${videoTitle}）的完整歌詞內容。

請生成逐字幕，每段包含開始/結束時間（秒）、日文原文、振假名、繁體中文翻譯。

【振假名標注規則】
1. 漢字與活用語尾視為一個 word（去られ→さられ、笑った→わらった）。
2. 每個漢字都必須有對應的 furigana 項目。
3. reading 為純平假名。
4. id 欄位填入空字串。`;
    }

    // ── 步驟 3：呼叫 AI ──────────────────────────────────────────────────
    let finalSegments: z.infer<typeof SegmentSchema>[];

    if (provider === 'groq') {
      const raw = await groqGenerate(userApiKey, modelId, [
        { role: 'system', content: '你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。' },
        { role: 'user', content: prompt + '\n\n' + SEGMENTS_JSON_HINT },
      ]);
      finalSegments = parseGroqSegments(raw);
    } else {
      const ai = createAi(provider, userApiKey);
      const { output } = await generateWithRetry(ai, {
        model: modelId,
        output: { schema: z.object({ segments: z.array(SegmentSchema) }) },
        prompt,
      });
      if (!output?.segments?.length) throw new Error('解析失敗，請檢查 API Key 或稍後再試。');
      finalSegments = output.segments;
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
