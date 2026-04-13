
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openai } from 'genkitx-openai';

/**
 * @fileOverview Genkit 初始化配置 - 穩定版
 */

export const ai = genkit({
  plugins: [
    googleAI(),
    openai({
      baseURL: 'https://api.groq.com/openai/v1',
    })
  ],
});

export { z };
