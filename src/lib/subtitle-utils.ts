/**
 * @fileOverview 字幕處理工具 (v3.0)
 * 強化了 SRT 解析器，精準處理時間軸（支援逗號與點號）與多行文字內容。
 */

/**
 * 將 SRT 時間字串（00:00:00,000 或 00:00:00.000）轉換為秒數
 */
export function srtTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  // 處理毫秒前的逗號或點號
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length !== 3) return 0;
  
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  
  return h * 3600 + m * 60 + s;
}

/**
 * 解析 SRT 字幕內容
 * 支援標準索引、時間軸與多行歌詞。
 */
export function parseSRT(content: string): Array<{ text: string; start: number; end: number }> {
  const segments: Array<{ text: string; start: number; end: number }> = [];
  
  // 統一換行符並依據空行分割區塊
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const blocks = normalizedContent.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // 尋找包含時間軸的一行 (例如 00:00:40,630 --> 00:00:50,670)
    let timeLineIndex = -1;
    const timeRegex = /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/;
    
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex !== -1) {
      const match = lines[timeLineIndex].match(timeRegex);
      if (match) {
        const start = srtTimeToSeconds(match[1]);
        const end = srtTimeToSeconds(match[2]);

        // 時間線之後的所有行均視為歌詞文字，並合併為單行
        const textLines = lines.slice(timeLineIndex + 1);
        const text = textLines.join(' ')
          .replace(/<[^>]+>/g, '') // 移除潛在的 HTML 標記
          .trim();

        if (text) {
          segments.push({ text, start, end });
        }
      }
    }
  }
  return segments;
}

/**
 * 解析純文字歌詞（每一句預設分配 5 秒）
 */
export function parseTXT(content: string): Array<{ text: string; start: number; end: number }> {
  const lines = content.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 1);

  return lines.map((line, i) => {
    // 移除音樂符號
    const cleaned = line.replace(/[♪♫♬]/g, '').trim();
    const start = i * 5.0;
    return {
      text: cleaned || line,
      start: start,
      end: start + 5.0
    };
  });
}
