
/**
 * @fileOverview 羅馬拼音轉換工具 - 終極校正版
 */

export const HIRAGANA_MAP: Record<string, string> = {
  "あ":"a","い":"i","う":"u","え":"e","お":"o",
  "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
  "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
  "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
  "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
  "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
  "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
  "や":"ya","ゆ":"yu","よ":"yo",
  "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
  "わ":"wa","を":"o","ん":"n",
  "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
  "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
  "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
  "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
  "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
  "きゃ":"kya","きゅ":"kyu","きょ":"kyo",
  "しゃ":"sha","しゅ":"shu","しょ":"sho",
  "ちゃ":"cha","ちゅ":"chu","ちょ":"cho",
  "にゃ":"nya","にゅ":"nyu","にょ":"nyo",
  "ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo",
  "みゃ":"mya","みゅ":"myu","みょ":"myo",
  "りゃ":"rya","りゅ":"ryu","りょ":"ryo",
  "ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo",
  "じゃ":"ja","じゅ":"ju","じょ":"jo",
  "びゃ":"bya","びゅ":"byu","びょ":"byo",
  "ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo",
  "っ":"","ー":"-","、":", ","。":". ","！":"! ","？":"? "," ":" ","　":" "
};

export function toHiragana(s: string): string {
  return s.split('').map(char => {
    const code = char.charCodeAt(0);
    // 轉片假名為平假名
    return (code >= 0x30A1 && code <= 0x30F6) ? String.fromCharCode(code - 0x60) : char;
  }).join('');
}

export function convertToRomaji(input: string): string {
  if (!input) return "";
  
  const h = toHiragana(input);
  let results: string[] = [];
  const chars = Array.from(h);
  let i = 0;
  
  while (i < chars.length) {
    const char = chars[i];
    
    // 1. 處理二合音 (如 きゃ)
    const nextChar = chars[i + 1] || "";
    const twoChars = char + nextChar;
    if (HIRAGANA_MAP[twoChars]) {
      results.push(HIRAGANA_MAP[twoChars]);
      i += 2;
      continue;
    }

    // 2. 處理促音 (っ)
    if (char === "っ") {
      if (i + 1 < chars.length) {
        const nextTwo = chars[i+1] + (chars[i+2] || "");
        const nextSingle = chars[i+1];
        const targetRomaji = HIRAGANA_MAP[nextTwo] || HIRAGANA_MAP[nextSingle];
        if (targetRomaji && targetRomaji.length > 0) {
          results.push(targetRomaji.charAt(0));
        }
      }
      i++;
      continue;
    }

    // 3. 一般字元（CJK 漢字直接跳過，無法轉羅馬拼音）
    const mapped = HIRAGANA_MAP[char];
    if (mapped !== undefined) {
      results.push(mapped);
    } else {
      const code = char.charCodeAt(0);
      const isCJK = (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF);
      if (!isCJK) results.push(char);
    }
    i++;
  }
  
  return results.join(" ").replace(/\s+/g, ' ').trim().toLowerCase();
}
