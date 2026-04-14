/**
 * @fileOverview LrcLib.net API 客戶端
 * 免費、無需 API Key 的同步歌詞庫，支援日文歌詞。
 * API 文件：https://lrclib.net/docs
 */

export interface LrcLibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export interface LrcSegment {
  start: number;
  end: number;
  text: string;
}

/** 解析 LRC 時間字串 [MM:SS.xx] 為秒數 */
function parseLrcTime(timeStr: string): number {
  const m = timeStr.match(/(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]) + parseFloat('0.' + m[3]);
}

/** 將 syncedLyrics（LRC 格式）解析為帶時間軸的段落 */
export function parseLRC(syncedLyrics: string, totalDuration = 0): LrcSegment[] {
  const timed: Array<{ time: number; text: string }> = [];

  for (const line of syncedLyrics.split('\n')) {
    const match = line.match(/^\[(\d+:\d+[.,]\d+)\]\s*(.*)/);
    if (!match) continue;
    const text = match[2].trim();
    if (text) timed.push({ time: parseLrcTime(match[1]), text });
  }

  if (timed.length === 0) return [];

  return timed.map((item, i) => {
    const start = item.time;
    const nextStart = timed[i + 1]?.time ?? 0;
    // end = 下一句開始，最少 1s，最多 +8s
    let end = nextStart > 0 ? nextStart : (totalDuration > start ? totalDuration : start + 5);
    end = Math.max(end, start + 1.0);
    if (end - start > 8) end = start + 6;
    return { start, end, text: item.text };
  });
}

/**
 * 從影片標題嘗試提取歌名與歌手
 * 支援常見格式：「歌手 - 歌名」「歌手 / 歌名」「歌名 - 歌手」
 */
function parseVideoTitle(title: string): { songTitle: string; artist: string } {
  // 去掉括號內容（MV / Official / Live 等）
  const clean = title
    .replace(/\s*[\(\[【「][^\)\]】」]*[\)\]】」]/g, '')
    .replace(/\b(official|music|video|mv|pv|lyric|lyrics|full|hd|4k|live|ver|version)\b/gi, '')
    .trim();

  // 以 - 或 / 分割
  const sep = clean.match(/^(.+?)\s*[-–/／]\s*(.+)$/);
  if (sep) {
    const a = sep[1].trim();
    const b = sep[2].trim();
    // 含日文字的部分更可能是歌名
    const bHasJP = /[\u3040-\u9FFF]/.test(b);
    const aHasJP = /[\u3040-\u9FFF]/.test(a);
    if (bHasJP && !aHasJP) return { songTitle: b, artist: a };
    if (aHasJP && !bHasJP) return { songTitle: a, artist: b };
    // 兩邊都有日文：前半通常是歌手，後半是歌名
    return { songTitle: b, artist: a };
  }

  return { songTitle: clean, artist: '' };
}

/**
 * 搜尋 LrcLib 取得同步歌詞。
 * 回傳 null 表示找不到，或找到但無同步歌詞。
 */
export async function searchLrcLib(
  videoTitle: string
): Promise<{ track: LrcLibTrack; segments: LrcSegment[] } | null> {
  const { songTitle, artist } = parseVideoTitle(videoTitle);

  // 多種查詢策略，依序嘗試
  const queries = [
    artist ? `${songTitle} ${artist}` : null,
    songTitle,
    videoTitle.replace(/[\(\[【「][^\)\]】」]*[\)\]】」]/g, '').trim(),
  ].filter((q): q is string => !!q && q.length > 1);

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
        {
          headers: { 'User-Agent': 'JSONG-Trans/1.0 (https://jsong-trans.vercel.app)' },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) continue;

      const list: LrcLibTrack[] = await res.json();
      if (!Array.isArray(list) || list.length === 0) continue;

      // 優先選擇有同步歌詞且非純音樂的曲目
      const candidates = list.filter(t => !t.instrumental && t.syncedLyrics);
      const track = candidates[0] ?? list.find(t => !t.instrumental) ?? list[0];

      if (!track || track.instrumental) continue;

      if (track.syncedLyrics) {
        const segments = parseLRC(track.syncedLyrics, track.duration);
        if (segments.length >= 3) {
          console.log(`LrcLib hit: "${track.artistName} - ${track.trackName}" (${segments.length} lines)`);
          return { track, segments };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
