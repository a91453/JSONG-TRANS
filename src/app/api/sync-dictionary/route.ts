/**
 * GET / POST /api/sync-dictionary
 *
 * 把使用者字典同步到 Firestore：users/{uid}/data。
 * 透過 Firebase Auth 的 ID token 驗證身份，每位 user 只能讀寫自己的資料。
 *
 * GET  → 回傳雲端字典（若尚未上傳，dictionary === null）
 * POST → 上傳本地字典覆寫雲端（last-write-wins）
 *
 * Authorization 標頭格式：
 *   Authorization: Bearer <firebase-id-token>
 */

import { db } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

// firebase-admin/auth 需要 app 已初始化；若 db 已 init 就會跑過
function ensureAdminApp() {
  if (getApps().length > 0) return;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return;
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function verifyAndGetUid(req: Request): Promise<string | null> {
  ensureAdminApp();
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const idToken = header.substring(7).trim();
  if (!idToken) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (e) {
    console.warn('[SyncDictionary] verifyIdToken 失敗:', (e as Error)?.message);
    return null;
  }
}

export async function GET(req: Request) {
  if (!db) {
    return Response.json({ ok: false, error: 'Firestore 未設定（缺 FIREBASE_* 環境變數）' }, { status: 500 });
  }
  const uid = await verifyAndGetUid(req);
  if (!uid) return Response.json({ ok: false, error: '未授權，請先登入 Google 帳號' }, { status: 401 });

  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.exists ? snap.data() : null;
    return Response.json({
      ok: true,
      hasCloud:    !!data?.dictionary,
      dictionary:  data?.dictionary ?? null,
      updatedAt:   data?.updatedAt ?? null,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? '讀取失敗' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!db) {
    return Response.json({ ok: false, error: 'Firestore 未設定（缺 FIREBASE_* 環境變數）' }, { status: 500 });
  }
  const uid = await verifyAndGetUid(req);
  if (!uid) return Response.json({ ok: false, error: '未授權，請先登入 Google 帳號' }, { status: 401 });

  try {
    const body = await req.json();
    const dictionary = body?.dictionary;
    if (!dictionary || !Array.isArray(dictionary.entries)) {
      return Response.json({ ok: false, error: 'payload 缺少 dictionary.entries 陣列' }, { status: 400 });
    }
    // 防呆：避免單次寫入過大（Firestore 1MB 限制）
    const sizeKb = JSON.stringify(dictionary).length / 1024;
    if (sizeKb > 900) {
      return Response.json({ ok: false, error: `字典過大（${Math.round(sizeKb)} KB），超過 Firestore 文件 1MB 上限` }, { status: 413 });
    }

    const updatedAt = Date.now();
    await db.collection('users').doc(uid).set(
      { dictionary, updatedAt },
      { merge: true }
    );
    return Response.json({ ok: true, updatedAt, entryCount: dictionary.entries.length });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? '寫入失敗' }, { status: 500 });
  }
}
