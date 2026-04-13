
'use server';
/**
 * @fileOverview 影片解析 AI 流程 - 終極標註加固版
 * 強制要求將「漢字+活用語尾」視為單一標註單元，根除羅馬音層的漢字遺漏。
 */

import { ai, z } from '@/ai/genkit';

const FuriganaItemSchema = z.object({
  word: z.string().describe('包含漢字的完整語義單元（例如：去られ、合う、目覺めて、笑った）。必須包含其連動的活用語尾。'),
  reading: z.string().describe('該單元的完整平假名讀音（例如：さらられ、あう、めざめて、わらった）。'),
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

export async function analyzeVideoAction(input: z.infer<typeof AnalyzeVideoInputSchema>) {
  const provider = input.config?.provider || 'google';
  const userApiKey = input.config?.apiKey;
  
  if (!userApiKey) {
    throw new Error(`請先前往「設定」頁面設定您的 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key。`);
  }

  try {
    const modelId = input.config?.model || (provider === 'google' ? 'googleai/gemini-1.5-flash' : 'openai/llama-3.3-70b-versatile');
    
    if (provider === 'google') {
      process.env.GOOGLE_GENAI_API_KEY = userApiKey;
    } else {
      process.env.OPENAI_API_KEY = userApiKey;
    }

    const { output } = await ai.generate({
      model: modelId,
      input: { 
        videoId: input.videoId, 
        videoTitle: input.videoTitle 
      },
      output: { schema: z.object({ segments: z.array(SegmentSchema) }) },
      config: { 
        googleSearchRetrieval: provider === 'google',
      },
      prompt: `
        你是一位日語語言學專家。你的任務是解析影片 ID: {{videoId}} (標題: {{videoTitle}}) 的內容。
        
        【複合單元標註命令 - 極其重要】
        1. 漢字及其連動的活用語尾必須被視為一個「單一 word」標註。
           - 正確範例：word: "去られ", reading: "さらられ"
           - 正確範例：word: "笑った", reading: "わらった"
           - 嚴禁：將 "去" 與 "られ" 分開標註。這會導致羅馬拼音層出現漢字。
        2. 全漢字覆蓋：日文原文中的每一個漢字都必須在 furigana 陣列中有對應項目。
        3. 讀音保證：讀音 (reading) 必須是純平假名，且代表該完整 word 的讀音。
        
        【內容要求】
        - 繁體中文翻譯必須優美且符合語境。
        - 輸出必須嚴格遵守 JSON Schema。
      `,
    });

    if (!output?.segments) throw new Error('解析失敗，請檢查 API Key 或稍後再試。');
    
    return {
      videoId: input.videoId,
      duration: output.segments[output.segments.length - 1]?.end || 0,
      segments: output.segments.map(s => ({ ...s, id: crypto.randomUUID() })),
    };
  } catch (error: any) {
    console.error('Error in analyzeVideoAction:', error);
    if (error.message?.includes('429') || error.message?.includes('Quota') || error.message?.includes('limit')) {
      throw new Error('API 請求配額已滿，請稍候 30 秒再試。');
    }
    throw error;
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
    const modelId = config?.model || (provider === 'google' ? 'googleai/gemini-1.5-flash' : 'openai/llama-3.3-70b-versatile');
    
    if (provider === 'google') {
      process.env.GOOGLE_GENAI_API_KEY = userApiKey;
    } else {
      process.env.OPENAI_API_KEY = userApiKey;
    }

    const { output } = await ai.generate({
      model: modelId,
      input: { segments },
      output: { schema: z.object({ annotatedSegments: z.array(SegmentSchema) }) },
      prompt: `
        請為以下段落進行日語標註。
        【複合單元規則】：漢字與其活用語尾（如：去られ、合う、目覺めて、笑った）必須視為一個單元標註。
        確保讀音 (reading) 為純平假名並包含整個單元的讀音。
        
        輸入：
        {{#each segments}}
        - [{{start}}s - {{end}}s] {{text}}
        {{/each}}
      `,
    });

    if (!output?.annotatedSegments) throw new Error('AI 標註失敗');
    
    return {
      videoId: "custom_" + Date.now(),
      duration: segments[segments.length - 1]?.end || 0,
      segments: output.annotatedSegments.map(s => ({ ...s, id: crypto.randomUUID() })),
    };
  } catch (error: any) {
    console.error('Error in annotateSegmentsAction:', error);
    throw error;
  }
}
