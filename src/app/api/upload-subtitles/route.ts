/**
 * POST /api/upload-subtitles
 *
 * 手動上傳 YouTube 網址 + SRT 字幕到 Firestore 快取。
 * 下次其他使用者分析同一支影片時會直接命中快取，跳過所有抓取管線。
 *
 * Request body:
 *   { videoUrl: string, srtContent: string }
 *
 * Response:
 *   200 { ok: true, videoId, segmentCount }
 *   400 { ok: false, error }      — 參數錯誤／URL 無效／SRT 無法解析
 *   500 { ok: false, error }      — Firestore 未設定或寫入失敗
 */

import { db } from '@/lib/firebase-admin';
import { extractVideoID } from '@/lib/youtube';
import { parseSRT } from '@/lib/subtitle-utils';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天，與 youtube-actions.ts 一致

export async function POST(req: Request) {
  try {
    const { videoUrl, srtContent } = await req.json();

    if (typeof videoUrl !== 'string' || typeof srtContent !== 'string') {
      return Response.json({ ok: false, error: '缺少 videoUrl 或 srtContent' }, { status: 400 });
    }

    // ── 1. 解析 YouTube 網址 ─────────────────────────────────────────────
    const videoId = extractVideoID(videoUrl);
    if (!videoId || videoId.length !== 11) {
      return Response.json({ ok: false, error: '無效的 YouTube 網址，請確認格式' }, { status: 400 });
    }

    // ── 2. 解析 SRT ──────────────────────────────────────────────────────
    const segments = parseSRT(srtContent);
    if (segments.length < 1) {
      return Response.json(
        { ok: false, error: 'SRT 內容無法解析，請檢查格式是否正確（需有時間軸與歌詞）' },
        { status: 400 }
      );
    }

    // ── 3. 檢查 Firestore 是否配置 ───────────────────────────────────────
    if (!db) {
      return Response.json(
        { ok: false, error: 'Firestore 未設定，無法寫入快取（請先設定 FIREBASE_* 環境變數）' },
        { status: 500 }
      );
    }

    // ── 4. 檢查是否已有未過期快取（避免覆寫高品質來源）─────────────────────
    const ref  = db.collection('subtitles').doc(videoId);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as { expiresAt?: number; source?: string } | undefined;
      const stillValid = !!data && (!data.expiresAt || Date.now() <= data.expiresAt);
      if (stillValid) {
        return Response.json({
          ok: false,
          videoId,
          alreadyCached: true,
          existingSource: data?.source ?? 'unknown',
          error: `此影片雲端已有快取（來源：${data?.source ?? 'unknown'}），無需重複上傳`,
        }, { status: 409 });
      }
    }

    // ── 5. 寫入 Firestore ────────────────────────────────────────────────
    const now = Date.now();
    const doc = {
      videoId,
      segments,
      source: 'manual' as const,
      cachedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };

    await ref.set(doc);

    return Response.json({
      ok: true,
      videoId,
      segmentCount: segments.length,
    });

  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message ?? '上傳失敗' },
      { status: 500 }
    );
  }
}
