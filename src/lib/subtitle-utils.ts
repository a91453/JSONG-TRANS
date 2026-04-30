/**
 * @fileOverview 字幕處理工具 (v3.0)
 * 強化了 SRT 解析器，精準處理時間軸（支援逗號與點號）與多行文字內容。
 * 支援雙語 SRT（日文 + 中文翻譯雙行），自動分離 japanese / translation。
 * 另提供秒數→SRT 時間字串轉換與 SRT 匯出功能。
 */

/** 將秒數轉換為 SRT 時間字串 00:00:00,000 */
export function secondsToSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * 將段落陣列匯出為 SRT 字串（日文 + 中文翻譯雙行）
 */
export function generateSRT(
  segments: Array<{ start: number; end: number; japanese: string; translation?: string }>
): string {
  return segments
    .map((seg, i) => {
      const lines: string[] = [seg.japanese];
      if (seg.translation) lines.push(seg.translation);
      return `${i + 1}\n${secondsToSrtTime(seg.start)} --> ${secondsToSrtTime(seg.end)}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * 將 SRT 時間字串（00:00:00,000 或 00:00:00.000）轉換為秒數
 */
export function srtTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length !== 3) return 0;
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

/** 判斷是否含有日文（平假名或片假名） */
function hasJapanese(text: string): boolean {
  return /[぀-ゟ゠-ヿ]/.test(text);
}

/** 判斷是否為純中文行（有漢字但無平假名/片假名） */
function isChineseOnly(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text) && !hasJapanese(text);
}

export interface ParsedSRTSegment {
  text:         string;
  /** 若 SRT 已含中文翻譯則填入，可直接跳過 AI 翻譯步驟 */
  translation?: string;
  start:        number;
  end:          number;
}

/**
 * 解析 SRT 字幕內容。
 * 支援：
 *   - 標準單語 SRT（日文）
 *   - 雙語 SRT（第一行日文 + 第二行中文翻譯）
 *   - 多行文字合併為單行
 */
export function parseSRT(content: string): ParsedSRTSegment[] {
  const segments: ParsedSRTSegment[] = [];

  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const blocks = normalizedContent.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    const timeRegex = /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/;

    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const match = lines[timeLineIndex].match(timeRegex);
    if (!match) continue;

    const start = srtTimeToSeconds(match[1]);
    const end   = srtTimeToSeconds(match[2]);

    const textLines = lines.slice(timeLineIndex + 1)
      .map(l => l.replace(/<[^>]+>/g, '').trim())
      .filter(l => l.length > 0);

    if (textLines.length === 0) continue;

    // 雙語偵測：恰好兩行，第一行含日文，第二行為純中文
    if (
      textLines.length === 2 &&
      hasJapanese(textLines[0]) &&
      isChineseOnly(textLines[1])
    ) {
      segments.push({
        text:        textLines[0],
        translation: textLines[1],
        start,
        end,
      });
    } else {
      // 單語或多行合併
      segments.push({
        text:  textLines.join(' '),
        start,
        end,
      });
    }
  }

  return segments;
}

/**
 * 解析純文字歌詞（每一句預設分配 5 秒）
 */
export function parseTXT(content: string): ParsedSRTSegment[] {
  const lines = content.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 1);

  return lines.map((line, i) => {
    const cleaned = line.replace(/[♪♫♬]/g, '').trim();
    const start = i * 5.0;
    return {
      text:  cleaned || line,
      start,
      end:   start + 5.0,
    };
  });
}

