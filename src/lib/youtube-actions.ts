'use server';
/**
 * @fileOverview YouTube 相關 Server Actions + SubtitleManager
 *
 * SubtitleManager（getSmartSubtitles）是所有字幕請求的「快取守門員」：
 *
 *   快取（Firestore）→ YouTube 官方/自動字幕 → LrcLib → 外部語音服務 → null
 *
 * 快取命中後直接回傳，無需再次呼叫外部 API，大幅降低延遲與費用。
 * Firestore 未配置時（db = null）快取層自動跳過，功能不受影響。
 */

import { db } from './firebase-admin';
import { fetchYouTubeCaptions } from './youtube-captions';
import { searchLrcLib } from './lrclib';
import { secondsToSrtTime } from './subtitle-utils';

// ── 型別定義 ─────────────────────────────────────────────────────────────────

export interface RawSegment {
  start: number;
  end: number;
  text: string;
}

export interface SmartSubtitleResult {
  videoId: string;
  segments: RawSegment[];
  /** 資料來源 */
  source: 'youtube-official' | 'youtube-auto' | 'lrclib' | 'external';
  /** LrcLib 曲目資訊（source === 'lrclib' 時提供，用於建立更精確的標注 prompt） */
  lrcTrackName?: string;
  lrcArtistName?: string;
}

/** Firestore 快取文件的內容 */
interface CachedDoc extends SmartSubtitleResult {
  cachedAt: number;  // Unix ms
  expiresAt: number; // Unix ms
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// ── 快取讀寫 ─────────────────────────────────────────────────────────────────

async function deleteCache(videoId: string): Promise<void> {
  if (!db) return;
  try {
    await db.collection('subtitles').doc(videoId).delete();
    console.log(`[SubtitleCache] 已刪除舊快取: ${videoId}`);
  } catch {
    // non-fatal
  }
}

async function readCache(videoId: string): Promise<SmartSubtitleResult | null> {
  if (!db) return null;
  try {
    const snap = await db.collection('subtitles').doc(videoId).get();
    if (!snap.exists) return null;
    const data = snap.data() as CachedDoc;
    // 過期則視為未命中
    if (data.expiresAt && Date.now() > data.expiresAt) {
      console.log(`[SubtitleCache] 快取過期: ${videoId}`);
      return null;
    }
    console.log(`[SubtitleCache] 快取命中: ${videoId} (${data.source}, ${data.segments.length} 段)`);
    return { videoId: data.videoId, segments: data.segments, source: data.source, lrcTrackName: data.lrcTrackName, lrcArtistName: data.lrcArtistName };
  } catch (e) {
    console.warn('[SubtitleCache] 讀取失敗，繼續無快取流程:', e);
    return null;
  }
}

async function writeCache(result: SmartSubtitleResult): Promise<void> {
  if (!db) return;
  try {
    const doc: CachedDoc = {
      ...result,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    await db.collection('subtitles').doc(result.videoId).set(doc);
    console.log(`[SubtitleCache] 已快取: ${result.videoId} (${result.source})`);
  } catch (e) {
    console.warn('[SubtitleCache] 寫入失敗（不影響主流程）:', e);
  }
}

// ── 外部語音微服務 ────────────────────────────────────────────────────────────

async function fetchExternalTranscription(videoId: string): Promise<RawSegment[] | null> {
  const serviceUrl = process.env.SUBTITLE_SERVICE_URL;
  if (!serviceUrl) return null;

  try {
    const res = await fetch(`${serviceUrl}/api/transcribe?v=${videoId}`, {
      signal: AbortSignal.timeout(120_000), // 語音轉錄最多等 2 分鐘
    });
    if (!res.ok) {
      console.warn(`[SubtitleCache] 外部服務回傳 ${res.status}`);
      return null;
    }
    const data = await res.json();
    // 期望 { segments: [{start, end, text}] }
    const segs: RawSegment[] = (data.segments ?? []).filter(
      (s: any) => typeof s.start === 'number' && typeof s.end === 'number' && s.text
    );
    return segs.length >= 3 ? segs : null;
  } catch (e) {
    console.warn('[SubtitleCache] 外部服務請求失敗:', e);
    return null;
  }
}

// ── SubtitleManager ───────────────────────────────────────────────────────────

/**
 * 所有字幕請求的統一入口（快取守門員）。
 *
 * 優先順序：
 *   1. Firestore 快取（30 天 TTL）
 *   2. YouTube 官方字幕 → 自動字幕
 *   3. LrcLib 同步歌詞
 *   4. 外部語音微服務（需設定 SUBTITLE_SERVICE_URL 環境變數）
 *   5. 回傳 null（由 analyze-video 降級至 Groq Whisper 或 AI 完整生成）
 *
 * @param videoId    - YouTube 11 位影片 ID
 * @param videoTitle - 影片標題（用於 LrcLib 搜尋）
 */
export async function getSmartSubtitles(
  videoId: string,
  videoTitle: string = '',
  forceRefresh = false
): Promise<SmartSubtitleResult | null> {
  // ── 1. 查 Firestore 快取（forceRefresh 時刪除舊快取並跳過）────────────
  if (forceRefresh) {
    await deleteCache(videoId);
  } else {
    const cached = await readCache(videoId);
    if (cached) return cached;
  }

  // ── 2. YouTube 官方/自動字幕 ────────────────────────────────────────────
  {
    const captionResult = await fetchYouTubeCaptions(videoId).catch(() => null);
    if (captionResult && captionResult.captions.length >= 3) {
      const result: SmartSubtitleResult = {
        videoId,
        segments: captionResult.captions.map(c => ({ start: c.start, end: c.end, text: c.text })),
        source: captionResult.isAuto ? 'youtube-auto' : 'youtube-official',
      };
      await writeCache(result);
      return result;
    }
  }

  // ── 3. LrcLib 同步歌詞 ──────────────────────────────────────────────────
  if (videoTitle) {
    const lrcResult = await searchLrcLib(videoTitle).catch(() => null);
    if (lrcResult && lrcResult.segments.length >= 3) {
      const result: SmartSubtitleResult = {
        videoId,
        segments: lrcResult.segments.map(s => ({ start: s.start, end: s.end, text: s.text })),
        source: 'lrclib',
        lrcTrackName: lrcResult.track.trackName,
        lrcArtistName: lrcResult.track.artistName,
      };
      await writeCache(result);
      return result;
    }
  }

  // ── 4. 外部語音微服務（SUBTITLE_SERVICE_URL 環境變數未設定則跳過）─────
  {
    const extSegments = await fetchExternalTranscription(videoId);
    if (extSegments) {
      const result: SmartSubtitleResult = {
        videoId,
        segments: extSegments,
        source: 'external',
      };
      await writeCache(result);
      return result;
    }
  }

  // ── 5. 全部失敗 → 回傳 null，由上層降級 ─────────────────────────────────
  return null;
}

// ── SRT 匯出（前端下載用，保持向後相容）─────────────────────────────────────

/**
 * 抓取 YouTube 日文字幕並回傳 SRT 格式字串（直接用於下載）。
 */
export async function fetchYouTubeSRT(
  videoId: string
): Promise<{ srt: string; isAuto: boolean; count: number } | null> {
  const result = await fetchYouTubeCaptions(videoId).catch(() => null);
  if (!result || result.captions.length < 3) return null;

  const srt = result.captions
    .map((c, i) =>
      `${i + 1}\n${secondsToSrtTime(c.start)} --> ${secondsToSrtTime(c.end)}\n${c.text}`
    )
    .join('\n\n');

  return { srt, isAuto: result.isAuto, count: result.captions.length };
}
