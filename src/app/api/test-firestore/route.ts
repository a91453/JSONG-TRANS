/**
 * GET /api/test-firestore
 *
 * 診斷用端點：測試 Firestore 連線、寫入、讀取是否正常。
 * 完成後自動刪除測試文件，不留殘留資料。
 *
 * 回傳範例（成功）：
 *   { ok: true, steps: { init: true, write: true, read: true, delete: true } }
 * 回傳範例（失敗）：
 *   { ok: false, steps: { init: false, ... }, error: "..." }
 */

import { db } from '@/lib/firebase-admin';

export async function GET() {
  const steps: Record<string, boolean> = {
    init: false,
    write: false,
    read: false,
    delete: false,
  };

  try {
    // ── 1. 檢查 db 是否初始化 ────────────────────────────────────────────
    if (!db) {
      return Response.json({
        ok: false,
        steps,
        error: '環境變數未設定或 Firebase Admin 初始化失敗。請確認 FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY 已在 Vercel 設定。',
      }, { status: 500 });
    }
    steps.init = true;

    const docRef = db.collection('_test').doc('connection-check');

    // ── 2. 寫入測試文件 ──────────────────────────────────────────────────
    await docRef.set({ ts: Date.now(), msg: 'hello from jsong-trans' });
    steps.write = true;

    // ── 3. 讀回驗證 ──────────────────────────────────────────────────────
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('寫入後讀不到文件');
    steps.read = true;

    // ── 4. 刪除測試文件（清理） ──────────────────────────────────────────
    await docRef.delete();
    steps.delete = true;

    return Response.json({ ok: true, steps });

  } catch (e: any) {
    return Response.json({
      ok: false,
      steps,
      error: e?.message ?? String(e),
    }, { status: 500 });
  }
}
