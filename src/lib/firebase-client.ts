/**
 * Firebase 客戶端 SDK — 惰性初始化（瀏覽器端單例）
 *
 * ⚠️ 模組載入時不立即初始化。
 *    Next.js 在 SSR 階段也會執行 Client Component 的模組，
 *    若在模組頂層呼叫 getAuth()，Vercel build 時缺少 NEXT_PUBLIC_* 變數
 *    會拋出 auth/invalid-api-key 導致 build 失敗。
 *
 * 解法：改用 getFirebaseAuth() 工廠函式：
 *   - 在服務端（SSR / build）回傳 null，靜默跳過
 *   - 在瀏覽器端，以 NEXT_PUBLIC_* 變數初始化並回傳 Auth 實例
 *
 * 必要環境變數（Vercel Dashboard → Environment Variables）：
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _auth: Auth | null = null;

/**
 * 取得 Firebase Auth 實例（瀏覽器環境才有效）。
 * - 服務端（typeof window === 'undefined'）→ 回傳 null，靜默跳過
 * - 瀏覽器端 → 第一次呼叫時初始化並快取
 */
export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  if (_auth) return _auth;

  try {
    const config = {
      apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId:      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    if (!config.apiKey) {
      console.warn('[Firebase] NEXT_PUBLIC_FIREBASE_API_KEY 未設定，Google 登入將無法使用。');
      return null;
    }

    const app: FirebaseApp = getApps().length === 0
      ? initializeApp(config)
      : getApps()[0];

    _auth = getAuth(app);
    return _auth;
  } catch (e) {
    console.warn('[Firebase] 客戶端初始化失敗:', e);
    return null;
  }
}
