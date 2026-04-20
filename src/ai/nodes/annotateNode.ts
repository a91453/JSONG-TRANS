/**
 * @fileOverview 標注節點（Annotation Node）
 *
 * 職責：接受原始字幕片段，呼叫 AI 補上振假名 + 繁中翻譯。
 * 同時承擔 Schema 定義，讓 analyze-video.ts 與 analyze-stream/route.ts
 * 共用同一套型別與邏輯，避免重複維護。
 */

import { createAi, z } from '@/ai/genkit';
import { groqGenerate } from '@/lib/groq-generate';
import { getPromptConfig } from '@/ai/prompt-store';

// ── 共用 Zod Schema ────────────────────────────────────────────────────────

export const FuriganaItemSchema = z.object({
  word:    z.string(),
  reading: z.string(),
});

export const SegmentSchema = z.object({
  id:          z.string(),
  start:       z.number(),
  end:         z.number(),
  japanese:    z.string(),
  translation: z.string(),
  furigana:    z.array(FuriganaItemSchema),
});

export type Segment    = z.infer<typeof SegmentSchema>;
export type RawSeg     = {
  start: number;
  end:   number;
  text:  string;
  /** 預標注振假名（如 Cloud Run 已提供）；存在時可走 translateBatch 僅翻譯路徑 */
  furigana?: z.infer<typeof FuriganaItemSchema>[];
};

// ── 工具 ──────────────────────────────────────────────────────────────────

function toTimestamp(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Groq JSON hints（Groq 不支援 Genkit native structured output）────────

const ANNOTATED_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"annotatedSegments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

const SEGMENTS_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"segments":[{"id":"","start":0,"end":5,"japanese":"日文原文","translation":"繁體中文翻譯","furigana":[{"word":"漢字單元","reading":"平假名讀音"}]}]}
`;

// ── 標注批次（有字幕來源時使用）──────────────────────────────────────────

export async function annotateBatch(
  batch:       RawSeg[],
  videoTitle:  string,
  sourceLabel: string,
  provider:    'google' | 'groq',
  apiKey:      string,
  model:       string
): Promise<Segment[]> {
  const cfg   = await getPromptConfig();
  const lines = batch
    .map(c => `[${toTimestamp(c.start)}-${toTimestamp(c.end)}] ${c.text}`)
    .join('\n');

  const prompt = `你是一位日語語言學專家。以下是歌曲「${videoTitle}」的${sourceLabel}歌詞片段：

${lines}

請嚴格按照時間戳與文字，為每一段進行以下處理：

${cfg.annotationRules}

${cfg.translationRules}`;

  if (provider === 'groq') {
    const raw  = await groqGenerate(apiKey, model, [
      { role: 'system', content: cfg.systemMessage },
      { role: 'user',   content: prompt + '\n\n' + ANNOTATED_HINT },
    ]);
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。'); }
    const r = z.object({ annotatedSegments: z.array(SegmentSchema) }).safeParse(json);
    if (!r.success) throw new Error('Groq 輸出格式不符合預期，請稍後再試。');
    return r.data.annotatedSegments.map((seg, i) => ({
      ...seg,
      start: batch[i]?.start ?? seg.start,
      end:   batch[i]?.end   ?? seg.end,
    }));
  }

  const ai = createAi(provider, apiKey);
  const { output } = await ai.generate({
    model,
    output: { schema: z.object({ annotatedSegments: z.array(SegmentSchema) }) },
    prompt,
  });
  if (!output?.annotatedSegments) throw new Error('AI 標注失敗');
  return output.annotatedSegments.map((seg, i) => ({
    ...seg,
    start: batch[i]?.start ?? seg.start,
    end:   batch[i]?.end   ?? seg.end,
  }));
}

// ── 僅翻譯批次（已有預標注振假名時使用，省去一次標注 AI 呼叫）────────────

const TRANSLATIONS_HINT = `
你必須僅回傳一個合法的 JSON 物件（不要有任何說明文字）：
{"translations":[{"index":0,"translation":"繁體中文翻譯"}]}
其中 index 必須對應輸入的 [索引] 編號（從 0 開始）。
`;

const TranslationsSchema = z.object({
  translations: z.array(z.object({
    index:       z.number(),
    translation: z.string(),
  })),
});

/**
 * 當字幕來源已提供振假名（例如 Cloud Run 轉錄服務）時使用。
 * 僅向 AI 請求繁體中文翻譯，保留預先標注的 furigana，明顯加速並省 API 配額。
 */
export async function translateBatch(
  batch:       RawSeg[],
  videoTitle:  string,
  sourceLabel: string,
  provider:    'google' | 'groq',
  apiKey:      string,
  model:       string
): Promise<Segment[]> {
  const cfg   = await getPromptConfig();
  const lines = batch
    .map((c, i) => `[${i}] [${toTimestamp(c.start)}-${toTimestamp(c.end)}] ${c.text}`)
    .join('\n');

  const prompt = `你是一位日語語言學專家。以下是歌曲「${videoTitle}」的${sourceLabel}歌詞片段（已含振假名，僅需翻譯）：

${lines}

請將每一段翻譯為繁體中文，回傳時以 index 對應原輸入的索引（從 0 開始）。

${cfg.translationRules}`;

  const applyTranslations = (translations: { index: number; translation: string }[]): Segment[] => {
    const byIndex = new Map(translations.map(t => [t.index, t.translation]));
    return batch.map((raw, i) => ({
      id:          '',
      start:       raw.start,
      end:         raw.end,
      japanese:    raw.text,
      translation: byIndex.get(i) ?? '',
      furigana:    raw.furigana ?? [],
    }));
  };

  if (provider === 'groq') {
    const raw = await groqGenerate(apiKey, model, [
      { role: 'system', content: cfg.systemMessage },
      { role: 'user',   content: prompt + '\n\n' + TRANSLATIONS_HINT },
    ]);
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。'); }
    const r = TranslationsSchema.safeParse(json);
    if (!r.success) throw new Error('Groq 翻譯輸出格式不符合預期，請稍後再試。');
    return applyTranslations(r.data.translations);
  }

  const ai = createAi(provider, apiKey);
  const { output } = await ai.generate({
    model,
    output: { schema: TranslationsSchema },
    prompt,
  });
  if (!output?.translations) throw new Error('AI 翻譯失敗');
  return applyTranslations(output.translations);
}

// ── 完整 AI 生成（無任何字幕來源時使用）──────────────────────────────────

export async function generateFull(
  videoId:    string,
  videoTitle: string,
  provider:   'google' | 'groq',
  apiKey:     string,
  model:      string
): Promise<Segment[]> {
  const cfg = await getPromptConfig();

  const prompt = `你是一位日語語言學專家。請解析 YouTube 影片 ID: ${videoId}（標題：${videoTitle}）的完整歌詞內容。

請生成逐字幕，每段包含開始/結束時間（秒）、日文原文、振假名、繁體中文翻譯。

${cfg.annotationRules}

4. id 欄位填入空字串。`;

  if (provider === 'groq') {
    const raw  = await groqGenerate(apiKey, model, [
      { role: 'system', content: cfg.systemMessage },
      { role: 'user',   content: prompt + '\n\n' + SEGMENTS_HINT },
    ]);
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。'); }
    const r = z.object({ segments: z.array(SegmentSchema) }).safeParse(json);
    if (!r.success) throw new Error('Groq 輸出格式不符合預期，請稍後再試。');
    return r.data.segments;
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
