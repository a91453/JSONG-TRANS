
'use server';
/**
 * @fileOverview 語句詳細解析 AI 流程 (支援多供應商)
 * Groq 供應商使用直接 fetch（繞過 genkitx-openai 相容性問題）。
 */

import { createAi, z } from '@/ai/genkit';
import { groqGenerate } from '@/lib/groq-generate';

const GrammarPointSchema = z.object({
  point: z.string().describe('文法要點或助詞'),
  explanation: z.string().describe('簡單易懂的繁體中文解釋'),
});

const ExplainOutputSchema = z.object({
  breakdown: z.array(z.object({
    token: z.string(),
    reading: z.string().optional(),
    partOfSpeech: z.string().describe('詞性'),
    meaning: z.string().describe('中文意思'),
  })),
  grammarPoints: z.array(GrammarPointSchema),
  cultureNote: z.string().optional().describe('文化背景或語境補充'),
});

export type ExplainOutput = z.infer<typeof ExplainOutputSchema>;

const EXPLAIN_JSON_HINT = `
你必須僅回傳一個合法的 JSON 物件，格式嚴格如下（不要有任何其他文字）：
{"breakdown":[{"token":"單字","reading":"讀音（可省略）","partOfSpeech":"詞性","meaning":"中文意思"}],"grammarPoints":[{"point":"文法點","explanation":"說明"}],"cultureNote":"語境補充（可省略，不需要時省略此欄位）"}
`;

export async function explainSentenceAction(
  sentence: string,
  config?: { provider?: 'google' | 'groq'; apiKey?: string; model?: string }
): Promise<ExplainOutput> {
  const provider = config?.provider || 'google';
  const userApiKey = config?.apiKey;

  if (!userApiKey) {
    throw new Error(`請先在設定中提供 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key 才能使用 AI 解說功能。`);
  }

  const modelId = config?.model || (provider === 'google' ? 'googleai/gemini-2.5-flash' : 'openai/llama-3.3-70b-versatile');

  const userPrompt = `你是一位資深的日語老師。請解析以下句子：
「${sentence}」

任務：
1. 拆解句子中的單字與助詞。
2. 說明關鍵文法點。
3. 如果有特定的口語用法或文化背景，請補充。

請以繁體中文回傳結構化資料。`;

  try {
    if (provider === 'groq') {
      const raw = await groqGenerate(userApiKey, modelId, [
        { role: 'system', content: '你是一位資深的日語老師，專門解析日文句子。你只回傳 JSON，不輸出任何說明文字。' },
        { role: 'user', content: userPrompt + '\n\n' + EXPLAIN_JSON_HINT },
      ]);

      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error('Groq 回傳的 JSON 格式無效，請稍後再試。');
      }
      const result = ExplainOutputSchema.safeParse(json);
      if (!result.success) throw new Error('Groq 輸出格式不符合預期，請稍後再試。');
      return result.data;
    }

    // Google Gemini 路徑
    const ai = createAi(provider, userApiKey);
    const { output } = await ai.generate({
      model: modelId,
      prompt: userPrompt,
      output: { schema: ExplainOutputSchema },
      config: provider === 'google' ? {} : undefined
    });

    if (!output) {
      throw new Error('AI 解說生成失敗');
    }
    return output;
  } catch (error: any) {
    console.error('Error in explainSentenceAction:', error);
    const msg: string = error.message || '';
    throw new Error(msg || 'AI 解說失敗，請檢查 API Key 或稍後再試。');
  }
}
