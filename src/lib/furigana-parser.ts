/**
 * @fileOverview 振假名字串解析器
 *
 * 將 Cloud Run 轉錄服務回傳的 inline 振假名字串：
 *   "桜(さくら)が咲(さ)きました。"
 *   "コケット(こけっと)を探して"
 * 轉為本專案內部陣列格式：
 *   [{ word: "桜", reading: "さくら" }, { word: "コケット", reading: "こけっと" }]
 */
export interface FuriganaItem {
  word:    string;
  reading: string;
}

// 漢字（含 々）OR 片假名 + 括號內平假名（允許長音 ー）
const FURIGANA_RE = /([一-鿿㐀-䶿々゠-ヿ]+)\(([぀-ゟー]+)\)/g;

/** 從 inline 振假名字串解析出 {word, reading} 陣列。 */
export function parseFuriganaString(s: string | null | undefined): FuriganaItem[] {
  if (!s) return [];
  const out: FuriganaItem[] = [];
  for (const m of s.matchAll(FURIGANA_RE)) {
    const word    = m[1]?.trim();
    const reading = m[2]?.trim();
    if (word && reading) out.push({ word, reading });
  }
  return out;
}

/** 從 inline 振假名字串中移除括號讀音，還原純日文（供 japanese 欄位使用）。 */
export function stripFurigana(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(FURIGANA_RE, '$1');
}
