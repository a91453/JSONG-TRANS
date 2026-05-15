/**
 * GET /api/admin/export-subtitles
 *
 * 一鍵匯出 Firestore `subtitles` collection 全部資料為 JSON 檔。
 * 需要管理員權限：Authorization: Bearer <ADMIN_TOKEN>
 *
 * Response：
 *   200  application/json + Content-Disposition: attachment
 *   401  { ok: false, error } — 密碼錯誤
 *   500  { ok: false, error } — Firestore 未設定或讀取失敗
 *   503  { ok: false, error } — 伺服器未設定 ADMIN_TOKEN
 */

export const maxDuration = 60;

import { db } from '@/lib/firebase-admin';
import { verifyAdminToken, extractBearerToken } from '@/lib/admin-auth';

export async function GET(req: Request) {
  // 1. 管理員驗證
  const auth = verifyAdminToken(extractBearerToken(req));
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  // 2. Firestore 連線檢查
  if (!db) {
    return Response.json(
      { ok: false, error: 'Firestore 未設定（請先設定 FIREBASE_* 環境變數）' },
      { status: 500 }
    );
  }

  // 3. 抓取所有 subtitles 文件
  try {
    const snap = await db.collection('subtitles').get();
    const subtitles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const payload = {
      exportedAt: new Date().toISOString(),
      count: subtitles.length,
      subtitles,
    };

    const date = new Date().toISOString().split('T')[0];
    const filename = `nihongopath-subtitles-${date}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Subtitle-Count': String(subtitles.length),
      },
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message ?? '匯出失敗' },
      { status: 500 }
    );
  }
}
