'use server';
/**
 * @fileOverview YouTube 相關 Server Actions + SubtitleManager
 *
 * SubtitleManager（getSmartSubtitles）是所有字幕請求的「快取守門員」：
 *
 *   快取（Firestore）→ YouTube 官方/自動字幕 → Cloud Run → Groq Whisper → LrcLib → null
 *
 * 快取命中後直接回傳，無需再次呼叫外部 API，大幅降低延遲與費用。
 * Firestore 未配置時（db = null）快取層自動跳過，功能不受影響。
 */

import { db } from './firebase-admin';
import { fetchYouTubeCaptions } from './youtube-captions';
import { searchLrcLib } from './lrclib';
import { secondsToSrtTime } from './subtitle-utils';
import { transcribeYouTubeWithWhisper } from './groq-whisper';

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
  source: 'youtube-official' | 'youtube-auto' | 'lrclib' | 'external' | 'whisper-groq';
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

// ── 外部語音微服務（Cloud Run）────────────────────────────────────────────────

/**
 * @throws {Error} 當 YouTube 需要 Google 驗證時（服務回傳 403 youtube_auth_required），
 *                 拋出 `Error('YOUTUBE_AUTH_REQUIRED')`，由呼叫端決定是否觸發 Google 登入流程。
 */
async function fetchExternalTranscription(
  videoId: string,
  googleToken?: string
): Promise<RawSegment[] | null> {
  const serviceUrl = process.env.SUBTITLE_SERVICE_URL;
  if (!serviceUrl) return null;

  const headers: Record<string, string> = {};
  const secret = process.env.SUBTITLE_SERVICE_SECRET;
  if (secret) headers['X-Service-Secret'] = secret;
  if (googleToken) headers['X-Google-Token'] = googleToken;

  try {
    const res = await fetch(`${serviceUrl}/api/transcribe?v=${videoId}`, {
      headers,
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'youtube_auth_required') {
          throw new Error('YOUTUBE_AUTH_REQUIRED');
        }
      }
      console.warn(`[SubtitleCache] 外部服務回傳 ${res.status}`);
      return null;
    }
    const data = await res.json();
    const segs: RawSegment[] = (data.segments ?? []).filter(
      (s: any) => typeof s.start === 'number' && typeof s.end === 'number' && s.text
    );
    return segs.length >= 3 ? segs : null;
  } catch (e: any) {
    if (e.message === 'YOUTUBE_AUTH_REQUIRED') throw e;
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
 *   2. YouTube 官方字幕 → 自動字幕（免 AI 成本，時間軸 100% 精準）
 *   3. 外部語音微服務 Cloud Run（需設定 SUBTITLE_SERVICE_URL，yt-dlp + Groq）
 *   4. Groq Whisper 語音聽寫（groqApiKey 有值時啟用，直接呼叫 Groq API 轉錄）
 *   5. LrcLib 同步歌詞（常見日文歌曲資料庫，速度快）
 *   6. 回傳 null → 由 analyze-video 降級至 AI 完整生成
 *
 * @param videoId     - YouTube 11 位影片 ID
 * @param videoTitle  - 影片標題（用於 LrcLib 搜尋）
 * @param forceRefresh - 清除快取並重新抓取
 * @param googleToken - Google OAuth token（Cloud Run 繞過 IP 封鎖用）
 * @param groqApiKey  - Groq API Key（啟用 Whisper 語音聽寫）
 */
export async function getSmartSubtitles(
  videoId: string,
  videoTitle: string = '',
  forceRefresh = false,
  googleToken?: string,
  groqApiKey?: string
): Promise<SmartSubtitleResult | null> {
  const isYouTube = videoId.length === 11;

  // ── 1. 查 Firestore 快取（forceRefresh 時刪除舊快取並跳過）────────────
  if (forceRefresh) {
    await deleteCache(videoId);
  } else {
    const cached = await readCache(videoId);
    if (cached) return cached;
  }

  // ── 2. YouTube 官方/自動字幕（時間軸 100% 精準，免 AI 成本）──────────
  if (isYouTube) {
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

  // ── 3. 外部語音微服務 Cloud Run（SUBTITLE_SERVICE_URL 未設定則跳過）────
  {
    const extSegments = await fetchExternalTranscription(videoId, googleToken);
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

  // ── 4. Groq Whisper（有 groqApiKey 時啟用，直接呼叫 Groq API 轉錄）───
  if (groqApiKey && isYouTube) {
    console.log(`[SubtitleManager] 嘗試 Groq Whisper...`);
    const whisperSegs = await transcribeYouTubeWithWhisper(videoId, groqApiKey).catch(() => null);
    if (whisperSegs && whisperSegs.length >= 3) {
      const result: SmartSubtitleResult = {
        videoId,
        segments: whisperSegs.map(s => ({ start: s.start, end: s.end, text: s.text })),
        source: 'whisper-groq',
      };
      await writeCache(result);
      console.log(`[SubtitleManager] Whisper 成功（${result.segments.length} 段）`);
      return result;
    }
    console.log(`[SubtitleManager] Whisper 失敗，繼續下一管線`);
  }

  // ── 5. LrcLib 同步歌詞 ──────────────────────────────────────────────────
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

  // ── 6. 全部失敗 → 回傳 null，由上層降級至 AI 完整生成 ─────────────────
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
