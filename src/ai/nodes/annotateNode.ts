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
export type RawSeg     = { start: number; end: number; text: string };

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
    return r.data.annotatedSegments;
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
