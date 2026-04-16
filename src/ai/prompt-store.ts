/**
 * @fileOverview Firestore 動態提示詞配置
 *
 * 從 Firestore `config/prompts` 讀取 AI Prompt 模板，支援熱更新——
 * 修改 Firestore 文件後，下次分析即生效，不需重新部署網站。
 *
 * Firestore 文件結構（`config/prompts`）：
 *   annotationRules  string — 振假名標注規則區塊
 *   translationRules string — 翻譯規則區塊
 *   systemMessage    string — AI 系統角色訊息
 *
 * 任意欄位缺失時退回至下方 DEFAULTS，不影響主流程。
 * 快取 5 分鐘（同一個 Serverless 容器實例內），避免每次請求都讀 Firestore。
 */

export interface PromptConfig {
  annotationRules:  string;
  translationRules: string;
  systemMessage:    string;
}

const DEFAULTS: PromptConfig = {
  annotationRules: `【振假名標注規則】
1. 漢字及其連動的活用語尾必須視為一個「單一 word」：
   - 正確：word:"去られ", reading:"さられ"
   - 正確：word:"笑った", reading:"わらった"
   - 嚴禁拆分（不可將"去"與"られ"分開）。
2. 日文原文中每一個漢字都必須在 furigana 陣列中有對應項目。
3. reading 必須是純平假名。`,

  translationRules: `【翻譯規則】
- 繁體中文翻譯，保持詩意與語境。
- 保留原始 start/end 時間戳，id 填入空字串。`,

  systemMessage: `你是日語語言學專家，只回傳 JSON，不輸出任何說明文字。`,
};

// ── 記憶體快取（Serverless 容器重啟前有效）──────────────────────────────
let _cache: { data: PromptConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

export async function getPromptConfig(): Promise<PromptConfig> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.data;

  try {
    // 動態 import 避免在 Edge Runtime 下出錯
    const { db } = await import('@/lib/firebase-admin');
    if (!db) return DEFAULTS;

    const snap = await db.collection('config').doc('prompts').get();
    if (!snap.exists) return DEFAULTS;

    const merged: PromptConfig = { ...DEFAULTS, ...(snap.data() as Partial<PromptConfig>) };
    _cache = { data: merged, expiresAt: Date.now() + CACHE_TTL_MS };
    return merged;
  } catch {
    return DEFAULTS;
  }
}
