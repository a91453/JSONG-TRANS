/**
 * @fileOverview Groq API 直接呼叫工具（繞過 genkitx-openai 相容性問題）
 * 使用 Groq OpenAI 相容端點 + json_object 模式取得結構化輸出。
 */

function stripOpenAIPrefix(model: string): string {
  return model.startsWith('openai/') ? model.slice(7) : model;
}

function classifyGroqError(status: number, body: string): Error {
  if (status === 401) return new Error('Groq API Key 無效，請至設定頁面重新確認。');
  if (status === 403) return new Error('Groq API Key 權限不足，請確認金鑰狀態。');
  if (status === 429) return new Error('Groq API 請求配額已滿，請稍候 30 秒再試。');
  if (status === 404) return new Error('找不到指定的 Groq 模型，請至設定頁面更換模型。');
  if (status === 503) return new Error('503');
  return new Error(`Groq 錯誤 ${status}: ${body.slice(0, 200)}`);
}

/**
 * 呼叫 Groq chat completions API，以 json_object 模式取得 JSON 字串。
 * 自動重試 503 最多 2 次（4s, 8s 間隔）。
 */
export async function groqGenerate(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxRetries = 2
): Promise<string> {
  const groqModel = stripOpenAIPrefix(model);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.15,
          max_tokens: 16384,
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error('Groq API 請求逾時，請稍後再試。');
      }
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const classified = classifyGroqError(res.status, body);
      if (classified.message === '503' && attempt < maxRetries) {
        const delay = (attempt + 1) * 4000;
        console.log(`Groq 503, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (classified.message === '503') {
        throw new Error('Groq 服務暫時繁忙，已自動重試仍失敗，請稍候再試。');
      }
      throw classified;
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('Groq 回傳空內容，請稍後再試。');
    return content;
  }

  throw new Error('Groq 重試次數已耗盡，請稍後再試。');
}
