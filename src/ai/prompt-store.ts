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
  annotationRules: `振假名規則：①漢字+活用語尾算一個word（去られ→さられ、笑った→わらった）②原文每個漢字（含時・人・日・年・事・気等常用字）都必須有furigana項目，不得遺漏③reading填純平假名`,

  translationRules: `翻譯規則：繁體中文，保詩意，id填空字串，保留start/end`,

  systemMessage: `你是日語語言學專家，只回傳JSON，不輸出說明文字。`,
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
