
'use server';
/**
 * @fileOverview 語句詳細解析 AI 流程 (支援多供應商)
 */

import { createAi, z } from '@/ai/genkit';

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

export async function explainSentenceAction(
  sentence: string, 
  config?: { provider?: 'google' | 'groq'; apiKey?: string; model?: string }
): Promise<ExplainOutput> {
  const provider = config?.provider || 'google';
  const userApiKey = config?.apiKey;
  
  if (!userApiKey) {
    throw new Error(`請先在設定中提供 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key 才能使用 AI 解說功能。`);
  }

  const modelId = config?.model || (provider === 'google' ? 'googleai/gemini-1.5-flash' : 'openai/llama-3.3-70b-versatile');
  const ai = createAi(provider, userApiKey);

  try {
    const { output } = await ai.generate({
      model: modelId,
      prompt: `你是一位資深的日語老師。請解析以下句子：
    「${sentence}」
    
    任務：
    1. 拆解句子中的單字與助詞。
    2. 說明關鍵文法點。
    3. 如果有特定的口語用法或文化背景，請補充。
    
    請以繁體中文回傳結構化資料。`,
      output: { schema: ExplainOutputSchema },
      config: {
        thinkingConfig: (provider === 'google' && modelId.includes('gemini-3')) ? {
          thinkingLevel: 'HIGH',
          includeThoughts: true
        } : undefined
      }
    });

    if (!output) {
      console.error('AI 解說生成失敗: output is empty');
      throw new Error('AI 解說生成失敗');
    }
    return output;
  } catch (error: any) {
    console.error('Error in explainSentenceAction:', error);
    throw error;
  }
}
