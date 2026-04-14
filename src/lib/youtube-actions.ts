'use server';
/**
 * @fileOverview YouTube 相關 Server Actions
 * 讓客戶端能透過伺服器側抓取 YouTube 字幕（避免 CORS 問題）
 */

import { fetchYouTubeCaptions } from './youtube-captions';
import { secondsToSrtTime } from './subtitle-utils';

/**
 * 抓取 YouTube 日文字幕並回傳 SRT 格式字串。
 * 回傳 null 表示該影片無可用字幕。
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
