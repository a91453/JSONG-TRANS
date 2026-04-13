
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from 'genkitx-openai';

/**
 * @fileOverview Genkit 初始化配置 - 穩定版
 * 使用 createAi() 工廠函式，避免 process.env 競態條件。
 */

export function createAi(provider: 'google' | 'groq', apiKey: string) {
  if (provider === 'google') {
    return genkit({ plugins: [googleAI({ apiKey })] });
  }
  // genkitx-openai@0.5.0 Plugin type 與 genkit@1.0.0 GenkitPlugin 不完全相容，以 any 繞過
  return genkit({ plugins: [openAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' } as any) as any] });
}

export { z };
