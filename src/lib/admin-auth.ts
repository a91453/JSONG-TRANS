/**
 * 管理員 Token 驗證工具（伺服器端）。
 *
 * 與 process.env.ADMIN_TOKEN 比對，使用 timing-safe 比較避免時間側通道攻擊。
 * 雙方都會 trim()，避免 .env 檔尾端換行或前後空白造成的「明明輸入正確卻被拒絕」。
 */

import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/**
 * 比對 client 提供的 token 與伺服器端 ADMIN_TOKEN。
 * - 503：伺服器未設定 ADMIN_TOKEN（部署問題，非密碼錯誤）
 * - 401：密碼錯誤
 */
export function verifyAdminToken(clientToken: string | undefined | null): AdminAuthResult {
  const serverToken = process.env.ADMIN_TOKEN?.trim();
  if (!serverToken) {
    return {
      ok: false,
      status: 503,
      error: '伺服器未設定 ADMIN_TOKEN 環境變數（請聯絡部署管理員）',
    };
  }
  const trimmed = (clientToken ?? '').trim();
  if (!trimmed || !safeEqual(trimmed, serverToken)) {
    return { ok: false, status: 401, error: '管理員密碼錯誤' };
  }
  return { ok: true };
}

/** 從 Authorization: Bearer <token> 標頭抽出 token。 */
export function extractBearerToken(req: Request): string {
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? '';
}
