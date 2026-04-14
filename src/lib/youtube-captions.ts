
/**
 * @fileOverview YouTube 字幕抓取工具
 * 使用 YouTube timedtext API（不需 API Key）
 * 嘗試順序：手動日文字幕 → ASR 自動日文字幕
 */

export interface RawCaption {
  start: number; // 秒
  end: number;   // 秒
  text: string;  // 日文字幕文字
  isAuto: boolean;
}

/**
 * 抓取 YouTube 日文字幕
 * 回傳 null 表示無可用字幕
 */
export async function fetchYouTubeCaptions(videoId: string): Promise<{ captions: RawCaption[]; isAuto: boolean } | null> {
  const attempts: Array<{ url: string; isAuto: boolean }> = [
    {
      url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&fmt=json3`,
      isAuto: false,
    },
    {
      url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&kind=asr&fmt=json3`,
      isAuto: true,
    },
  ];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        headers: {
          'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; NihongoPath/1.0)',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const text = await res.text();
      if (!text || text.length < 20) continue;

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }

      const captions = parseJson3(data, attempt.isAuto);
      if (captions.length >= 3) {
        return { captions, isAuto: attempt.isAuto };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseJson3(data: any, isAuto: boolean): RawCaption[] {
  if (!data?.events) return [];

  const raw: RawCaption[] = [];

  for (const event of data.events) {
    if (!event.segs) continue;

    const text = event.segs
      .map((s: any) => s.utf8 ?? '')
      .join('')
      .replace(/\n/g, ' ')
      .trim();

    if (!text) continue;

    const start = (event.tStartMs ?? 0) / 1000;
    const end = start + (event.dDurationMs ?? 2000) / 1000;

    raw.push({ start, end, text, isAuto });
  }

  return mergeShortSegments(raw);
}

/**
 * 合併過短的連續字幕片段（ASR 常見問題）
 */
function mergeShortSegments(captions: RawCaption[]): RawCaption[] {
  if (captions.length === 0) return [];

  const merged: RawCaption[] = [];
  let current = { ...captions[0] };

  for (let i = 1; i < captions.length; i++) {
    const next = captions[i];
    const gap = next.start - current.end;
    const duration = current.end - current.start;

    // 間隔小於 0.8s 且片段短於 4s 則合併
    if (gap < 0.8 && duration < 4 && current.text.length < 40) {
      current.text = (current.text + ' ' + next.text).trim();
      current.end = next.end;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}
