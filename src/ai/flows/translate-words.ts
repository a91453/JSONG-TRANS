/**
 * @fileOverview 字典單字級翻譯 Server Action
 *
 * 為單字補上獨立的繁中翻譯（區別於句子翻譯），讓「行く」這類在不同句子有不同
 * 句子翻譯的字仍保有穩定的詞義。使用者必須手動點按鈕才會呼叫，避免每次收藏
 * 都被動消耗 AI 配額。
 */
"use server";

import { createAi, z } from '@/ai/genkit';
import { groqGenerate } from '@/lib/groq-generate';

const TranslationItemSchema = z.object({
  word:        z.string(),
  reading:     z.string(),
  translation: z.string(),
});

const ResultSchema = z.object({
  translations: z.array(TranslationItemSchema),
});

const JSON_HINT = `JSON only:
{"translations":[{"word":"行く","reading":"いく","translation":"去"}]}`;

const SYS = '你是日語翻譯專家，只回傳 JSON，不輸出說明文字。';

export async function translateWordsAction(
  words:  { word: string; reading: string }[],
  config: { provider: 'google' | 'groq'; apiKey: string; model: string }
): Promise<{ word: string; reading: string; translation: string }[]> {
  if (words.length === 0) return [];
  if (!config.apiKey) throw new Error('缺少 API Key，請至設定頁面填入');

  const list   = words.map(w => `- ${w.word}（${w.reading}）`).join('\n');
  const prompt = `將以下日語單字翻譯為精簡繁體中文（每字 1–4 字，無解釋）：

${list}

逐字回傳，順序對應輸入；word/reading 完整保留輸入文字。`;

  if (config.provider === 'groq') {
    const raw = await groqGenerate(config.apiKey, config.model, [
      { role: 'system', content: SYS },
      { role: 'user',   content: prompt + '\n\n' + JSON_HINT },
    ]);
    let data: unknown;
    try { data = JSON.parse(raw); }
    catch { throw new Error('Groq 回傳的 JSON 格式無效'); }
    const r = ResultSchema.safeParse(data);
    if (!r.success) throw new Error('Groq 翻譯格式不符合預期');
    return r.data.translations;
  }

  const ai = createAi(config.provider, config.apiKey);
  const { output } = await ai.generate({
    model:  config.model,
    output: { schema: ResultSchema },
    prompt,
  });
  if (!output?.translations) throw new Error('AI 翻譯失敗');
  return output.translations;
}
