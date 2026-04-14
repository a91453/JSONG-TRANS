
'use server';
/**
 * @fileOverview 影片解析 AI 流程
 * 策略：優先使用 YouTube 官方字幕（更準確），無字幕時才讓 Gemini 完整生成。
 */

import { createAi, z } from '@/ai/genkit';
import { fetchYouTubeCaptions } from '@/lib/youtube-captions';

const FuriganaItemSchema = z.object({
  word: z.string().describe('包含漢字的完整語義單元（例如：去られ、合う、目覺めて、笑った）。必須包含其連動的活用語尾。'),
  reading: z.string().describe('該單元的完整平假名讀音（例如：さられ、あう、めざめて、わらった）。'),
});

const SegmentSchema = z.object({
  id: z.string(),
  start: z.number().describe('開始時間（秒）'),
  end: z.number().describe('結束時間（秒）'),
  japanese: z.string().describe('日文原文'),
  translation: z.string().describe('繁體中文翻譯'),
  furigana: z.array(FuriganaItemSchema).describe('必須包含句中所有漢字單元的正確讀音'),
});

const AnalyzeVideoInputSchema = z.object({
  videoId: z.string().describe('YouTube 影片 ID'),
  videoTitle: z.string().optional().describe('影片標題'),
  config: z.object({
    provider: z.enum(['google', 'groq']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
});

/** 將秒數轉為 mm:ss 格式（供 prompt 用） */
function toTimestamp(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** 判斷是否為 503 暫時性錯誤 */
function is503(msg: string, code?: number): boolean {
  return (
    code === 503 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('Service Unavailable') ||
    msg.includes('high demand')
  );
}

/** 帶重試的 ai.generate（503 最多重試 2 次） */
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
        const delay = (attempt + 1) * 4000; // 4s, 8s
        console.log(`503 detected, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('重試次數已耗盡');
}

export async function analyzeVideoAction(input: z.infer<typeof AnalyzeVideoInputSchema>) {
  const provider = input.config?.provider || 'google';
  const userApiKey = input.config?.apiKey;

  if (!userApiKey) {
    throw new Error(`請先前往「設定」頁面設定您的 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key。`);
  }

  try {
    const modelId = input.config?.model || (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');
    const ai = createAi(provider, userApiKey);

    // ── 步驟 1：嘗試抓取 YouTube 字幕 ──────────────────────────────────────
    const captionResult = input.videoId.length === 11
      ? await fetchYouTubeCaptions(input.videoId).catch(() => null)
      : null;

    let prompt: string;
    let expectedSource: 'server-sub' | 'server-sub-auto' | 'genkit-ai';

    if (captionResult && captionResult.captions.length >= 3) {
      // ── 有字幕：Gemini 只需補假名 + 翻譯 ──────────────────────────────
      expectedSource = captionResult.isAuto ? 'server-sub-auto' : 'server-sub';

      const captionLines = captionResult.captions
        .map(c => `[${toTimestamp(c.start)}-${toTimestamp(c.end)}] ${c.text}`)
        .join('\n');

      prompt = `你是一位日語語言學專家。以下是 YouTube 影片「${input.videoTitle || '未知'}」的${captionResult.isAuto ? '自動生成' : '官方'}字幕：

${captionLines}

請嚴格按照上方字幕的時間戳與文字，為每一段進行以下處理：

【振假名標注規則 - 極其重要】
1. 漢字及其連動的活用語尾必須視為一個「單一 word」：
   - 正確：word: "去られ", reading: "さられ"（不可拆分）
   - 正確：word: "笑った", reading: "わらった"
2. 日文原文中的每一個漢字都必須在 furigana 陣列中有對應項目。
3. reading 必須是純平假名，代表該完整 word 的正確讀音。

【翻譯規則】
- 翻譯必須優美、符合語境，使用繁體中文。
- 保留原文的時間戳（start/end）。
- 輸出必須嚴格遵守 JSON Schema，id 欄位填入空字串即可。`;
    } else {
      // ── 無字幕：Gemini 完整生成 ────────────────────────────────────────
      expectedSource = 'genkit-ai';

      prompt = `你是一位日語語言學專家。你的任務是解析 YouTube 影片 ID: ${input.videoId}（標題：${input.videoTitle || '未知'}）的完整內容。

請生成逐字幕內容，每段包含：開始/結束時間（秒）、日文原文、振假名標注、繁體中文翻譯。

【振假名標注規則 - 極其重要】
1. 漢字及其連動的活用語尾必須視為一個「單一 word」：
   - 正確：word: "去られ", reading: "さられ"
   - 正確：word: "笑った", reading: "わらった"
   - 嚴禁：將 "去" 與 "られ" 分開標注。
2. 日文原文中的每一個漢字都必須在 furigana 陣列中有對應項目。
3. reading 必須是純平假名。

【內容要求】
- 繁體中文翻譯必須優美且符合語境。
- 輸出必須嚴格遵守 JSON Schema。`;
    }

    // ── 步驟 2：呼叫 Gemini（503 自動重試）─────────────────────────────
    const { output } = await generateWithRetry(ai, {
      model: modelId,
      output: { schema: z.object({ segments: z.array(SegmentSchema) }) },
      prompt,
    });

    if (!output?.segments || output.segments.length === 0) {
      throw new Error('解析失敗，請檢查 API Key 或稍後再試。');
    }

    return {
      videoId: input.videoId,
      duration: output.segments[output.segments.length - 1]?.end || 0,
      segments: output.segments.map((s: any) => ({ ...s, id: crypto.randomUUID() })),
      source: expectedSource,
    };
  } catch (error: any) {
    console.error('Error in analyzeVideoAction:', error);
    const msg: string = error.message || '';
    const code: number = error.code || 0;
    if (is503(msg, code)) {
      throw new Error('AI 服務目前流量過高，已自動重試仍失敗。請稍候幾秒後再試一次。');
    }
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('API 請求配額已滿，請稍候 30 秒再試。');
    }
    if (msg.includes('403') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('PERMISSION_DENIED')) {
      throw new Error('API Key 無效或權限不足，請至設定頁面重新確認。');
    }
    if (msg.includes('404') || msg.includes('NOT_FOUND')) {
      throw new Error('找不到指定的 AI 模型，請至設定頁面更換模型。');
    }
    throw new Error(msg || '分析失敗，請檢查網路或 API 設定後再試。');
  }
}

export async function annotateSegmentsAction(
  segments: Array<{ start: number; end: number; text: string }>,
  config?: { provider?: 'google' | 'groq'; apiKey?: string; model?: string }
) {
  const provider = config?.provider || 'google';
  const userApiKey = config?.apiKey;

  if (!userApiKey) {
    throw new Error(`請提供 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key。`);
  }

  try {
    const modelId = config?.model || (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');
    const ai = createAi(provider, userApiKey);

    const segmentLines = segments.map(s => `- [${s.start}s - ${s.end}s] ${s.text}`).join('\n');

    const { output } = await ai.generate({
      model: modelId,
      output: { schema: z.object({ annotatedSegments: z.array(SegmentSchema) }) },
      prompt: `請為以下段落進行日語標注。
【複合單元規則】：漢字與其活用語尾（如：去られ、合う、目覺めて、笑った）必須視為一個單元標注。
確保 reading 為純平假名並包含整個單元的讀音。

輸入：
${segmentLines}`,
    });

    if (!output?.annotatedSegments) throw new Error('AI 標注失敗');

    return {
      videoId: 'custom_' + Date.now(),
      duration: segments[segments.length - 1]?.end || 0,
      segments: output.annotatedSegments.map((s: any) => ({ ...s, id: crypto.randomUUID() })),
      source: 'genkit-ai' as const,
    };
  } catch (error: any) {
    console.error('Error in annotateSegmentsAction:', error);
    const msg: string = error.message || '';
    throw new Error(msg || 'AI 標注失敗，請檢查 API Key 或稍後再試。');
  }
}
