/**
 * @fileOverview Firebase Admin SDK 初始化（伺服器端單例）
 *
 * 必要環境變數（在 Vercel Dashboard 或 .env.local 設定）：
 *   FIREBASE_PROJECT_ID      — Firebase 專案 ID
 *   FIREBASE_CLIENT_EMAIL    — 服務帳戶 Email
 *   FIREBASE_PRIVATE_KEY     — 服務帳戶私鑰（含 \n 換行符）
 *
 * 若以上變數未設定，db 會是 null；所有快取操作會靜默跳過，不影響主流程。
 */

import { type App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _db: Firestore | null = null;

function getDb(): Firestore | null {
  if (_db) return _db;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    // 未配置 → 靜默降級，不拋出錯誤
    return null;
  }

  try {
    const app: App = getApps().length === 0
      ? initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        })
      : getApps()[0];

    _db = getFirestore(app);
    return _db;
  } catch (e) {
    console.warn('[Firebase] 初始化失敗，快取功能將被停用:', e);
    return null;
  }
}

/** Firestore 實例；若環境變數未配置則為 null */
export const db = (() => {
  // Next.js 在模組載入時執行，此時 process.env 已可用
  try {
    return getDb();
  } catch {
    return null;
  }
})();
