
"use client"

import React, { useMemo } from 'react';
import { convertToRomaji } from '@/lib/romaji-utils';
import { cn } from '@/lib/utils';

interface FuriganaItem {
  word: string;
  reading: string;
}

export interface FuriganaTextProps {
  text: string;
  furiganaItems: FuriganaItem[];
  showFurigana: boolean;
  showRomaji: boolean;
  showKatakanaReading: boolean;
  /** 0 = unlimited (standard mode only) */
  maxCharsPerLine?: number;
  /** 'standard' = per-char flex row; 'wordcard' = colored pill cards */
  layout?: 'standard' | 'wordcard';
  /** wordcard mode: highlight the word whose estimated time matches currentTime */
  currentTime?: number;
  segmentStart?: number;
  segmentEnd?: number;
  fontSize?: number;
  active?: boolean;
  onWordClick?: (word: string, reading?: string) => void;
}

interface FuriToken {
  text: string;
  reading?: string;
  isAnnotated: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const KANA_RE      = /^[぀-ゟ゠-ヿー]$/;
const SMALL_KANA   = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/;
const CJK_RE       = /[一-鿿㐀-䶿]/;

function isPureKatakana(text: string): boolean {
  // Must contain at least one actual katakana character, and no other scripts
  // (spacing/middle-dot allowed but not sufficient alone).
  return /[゠-ヿ]/.test(text) && /^[゠-ヿー・　\s]+$/.test(text);
}

/**
 * Split an unannotated fragment for wordcard mode:
 * - Very short fragments (≤2 chars) stay as one pill regardless of script.
 * - Short pure-kana fragments (≤4 chars) also stay as one pill.
 * - Longer or mixed kana+kanji fragments are split at character boundaries,
 *   merging compound kana pairs (e.g. じゃ, きゅ) into a single unit.
 */
function splitUnannotatedForWordcard(text: string): FuriToken[] {
  if (!text) return [];
  if (text.length <= 2) {
    return [{ text, isAnnotated: false }];
  }
  if (text.length <= 4 && !CJK_RE.test(text)) {
    return [{ text, isAnnotated: false }];
  }
  const chars = Array.from(text);
  const result: FuriToken[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch   = chars[i];
    const next = chars[i + 1] ?? '';
    if (next && SMALL_KANA.test(next)) {
      result.push({ text: ch + next, isAnnotated: false });
      i += 2;
    } else {
      result.push({ text: ch, isAnnotated: false });
      i++;
    }
  }
  return result;
}

/** Cycle through soft pastel colours for pill cards */
const PILL_BG = [
  'bg-blue-100   dark:bg-blue-900/40',
  'bg-purple-100 dark:bg-purple-900/40',
  'bg-orange-100 dark:bg-orange-900/40',
  'bg-teal-100   dark:bg-teal-900/40',
  'bg-pink-100   dark:bg-pink-900/40',
  'bg-yellow-100 dark:bg-yellow-900/40',
];

/**
 * Estimate which rawToken index is "playing" at currentTime,
 * using linear interpolation over character positions within the segment.
 */
function getActiveTokenIndex(
  tokens: FuriToken[],
  currentTime: number,
  segStart: number,
  segEnd: number,
): number {
  if (!isFinite(currentTime) || currentTime < segStart || currentTime >= segEnd) return -1;
  const duration = segEnd - segStart;
  const totalLen = tokens.reduce((s, t) => s + t.text.length, 0);
  if (totalLen === 0) return -1;
  let charOffset = 0;
  for (let i = 0; i < tokens.length; i++) {
    const len   = tokens[i].text.length;
    const wStart = segStart + (charOffset / totalLen) * duration;
    const wEnd   = segStart + ((charOffset + len) / totalLen) * duration;
    if (currentTime >= wStart && currentTime < wEnd) return i;
    charOffset += len;
  }
  return tokens.length - 1;
}

// ── component ─────────────────────────────────────────────────────────────────

export const FuriganaText: React.FC<FuriganaTextProps> = ({
  text,
  furiganaItems,
  showFurigana,
  showRomaji,
  showKatakanaReading,
  maxCharsPerLine = 0,
  layout = 'standard',
  currentTime,
  segmentStart,
  segmentEnd,
  fontSize = 20,
  active = false,
  onWordClick,
}) => {
  // ── 1. Build raw token list (annotated words + unannotated fragments) ──────
  const rawTokens = useMemo((): FuriToken[] => {
    let parts: FuriToken[] = [{ text, isAnnotated: false }];
    // Drop items where word or reading is missing/empty — AI occasionally omits reading
    const sorted = [...furiganaItems]
      .filter(item => item.word && item.reading)
      .sort((a, b) => b.word.length - a.word.length);
    sorted.forEach(item => {
      const next: FuriToken[] = [];
      parts.forEach(part => {
        if (part.isAnnotated) { next.push(part); return; }
        const chunks = part.text.split(item.word);
        if (chunks.length > 1) {
          chunks.forEach((s, idx) => {
            if (s) next.push({ text: s, isAnnotated: false });
            if (idx < chunks.length - 1)
              next.push({ text: item.word, reading: item.reading, isAnnotated: true });
          });
        } else {
          next.push(part);
        }
      });
      parts = next;
    });
    return parts;
  }, [text, furiganaItems]);

  // ── 2. For standard mode: expand non-annotated → per-char tokens ──────────
  const flatTokens = useMemo((): FuriToken[] =>
    rawTokens.flatMap(tk =>
      tk.isAnnotated
        ? [tk]
        : Array.from(tk.text).map(ch => ({ text: ch, isAnnotated: false }))
    ),
  [rawTokens]);

  // ── 3. Standard mode: split into visual rows by maxCharsPerLine ───────────
  const standardLines = useMemo((): FuriToken[][] => {
    if (maxCharsPerLine <= 0) return [flatTokens];
    const rows: FuriToken[][] = [];
    let cur: FuriToken[] = [], count = 0;
    for (const tk of flatTokens) {
      const len = tk.text.length;
      if (count > 0 && count + len > maxCharsPerLine) { rows.push(cur); cur = []; count = 0; }
      cur.push(tk);
      count += len;
    }
    if (cur.length) rows.push(cur);
    return rows;
  }, [flatTokens, maxCharsPerLine]);

  // ── 4. Wordcard mode: expand unannotated tokens for better granularity ──────
  const wordcardTokens = useMemo((): FuriToken[] => {
    if (layout !== 'wordcard') return [];
    return rawTokens.flatMap(tk =>
      tk.isAnnotated ? [tk] : splitUnannotatedForWordcard(tk.text)
    );
  }, [rawTokens, layout]);

  // ── 5. Wordcard mode: active index ───────────────────────────────────────
  const activeIdx = useMemo(() => {
    if (layout !== 'wordcard') return -1;
    if (currentTime === undefined || segmentStart === undefined || segmentEnd === undefined) return -1;
    return getActiveTokenIndex(wordcardTokens, currentTime, segmentStart, segmentEnd);
  }, [layout, wordcardTokens, currentTime, segmentStart, segmentEnd]);

  const subFontSize = Math.max(fontSize * 0.52, 11);

  // ════════════════════════════════════════════════════════════════════════════
  // WORDCARD layout
  // ════════════════════════════════════════════════════════════════════════════
  if (layout === 'wordcard') {
    return (
      <div className={cn(
        'flex flex-wrap items-end gap-x-2 gap-y-6 transition-all duration-700',
        active ? 'opacity-100' : 'opacity-30',
      )}>
        {wordcardTokens.map((tk, idx) => {
          const reading = tk.reading ?? tk.text;
          const romaji  = convertToRomaji(reading);
          const hasFurigana    = tk.isAnnotated && !!tk.reading;
          const suppressKata   = !showKatakanaReading && tk.isAnnotated && isPureKatakana(tk.text);
          const isKana         = !tk.isAnnotated && KANA_RE.test(tk.text[0] ?? '');
          const canRomaji      = tk.isAnnotated ? !!tk.reading : isKana;

          const isActive       = idx === activeIdx;
          const colorClass     = PILL_BG[idx % PILL_BG.length];

          return (
            <div
              key={idx}
              className="flex flex-col items-center"
              onClick={e => { if (onWordClick) { e.stopPropagation(); onWordClick(tk.text, tk.reading); } }}
            >
              {/* furigana above pill */}
              <div className="h-5 flex items-end justify-center mb-0.5 w-full">
                {showFurigana && hasFurigana && !suppressKata && (
                  <span
                    style={{ fontSize: subFontSize * 0.85 }}
                    className="text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {tk.reading}
                  </span>
                )}
              </div>

              {/* pill */}
              <div
                className={cn(
                  'px-3 py-2 rounded-2xl cursor-pointer transition-all duration-300 select-none',
                  colorClass,
                  isActive
                    ? 'ring-2 ring-green-500 shadow-md scale-105'
                    : 'hover:scale-105',
                )}
              >
                <span
                  style={{ fontSize: `${fontSize}px` }}
                  className="font-bold leading-none tracking-tight block"
                >
                  {tk.text}
                </span>
              </div>

              {/* romaji below pill */}
              <div className="h-5 flex items-start justify-center mt-0.5 w-full">
                {showRomaji && canRomaji && !suppressKata && (
                  <span
                    style={{ fontSize: subFontSize * 0.8 }}
                    className="text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {romaji}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STANDARD layout (per-char tokens, multi-row)
  // ════════════════════════════════════════════════════════════════════════════
  const renderStdToken = (tk: FuriToken, idx: number) => {
    const reading = tk.reading ?? tk.text;
    const romaji  = convertToRomaji(reading);
    const hasFurigana    = tk.isAnnotated && !!tk.reading;
    const isKanaChar     = !tk.isAnnotated && KANA_RE.test(tk.text);
    const suppressKata   = !showKatakanaReading && tk.isAnnotated && isPureKatakana(tk.text);
    const canRomaji      = tk.isAnnotated ? !!tk.reading : isKanaChar;
    const showRomajiLine = showRomaji   && canRomaji    && !suppressKata;
    const showReadLine   = showFurigana && hasFurigana  && !suppressKata;
    const padX           = tk.isAnnotated ? 'px-4' : 'px-0.5';

    return (
      <div
        key={idx}
        className="flex flex-col items-center justify-end cursor-pointer transition-transform hover:scale-105"
        onClick={e => { if (onWordClick) { e.stopPropagation(); onWordClick(tk.text, tk.reading); } }}
      >
        <div className="h-6 flex items-end justify-center mb-1 w-full">
          {showRomajiLine && (
            <span style={{ fontSize: subFontSize * 0.7 }}
              className={cn('font-sans font-black tracking-[0.15em] whitespace-nowrap uppercase opacity-40',
                active ? 'text-primary' : 'text-muted-foreground/30')}>
              {romaji}
            </span>
          )}
        </div>
        <div className={cn(`${padX} py-2.5 rounded-[1.2rem] transition-all duration-500`,
          active ? 'bg-primary/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-primary/10' : 'border border-transparent')}>
          <span style={{ fontSize: `${fontSize}px` }}
            className={cn('font-bold leading-none tracking-tight block text-center',
              active ? 'text-foreground' : 'text-muted-foreground/10')}>
            {tk.text}
          </span>
        </div>
        <div className="h-6 flex items-start justify-center mt-1.5 w-full">
          {showReadLine && (
            <span style={{ fontSize: subFontSize }}
              className={cn('font-sans font-bold whitespace-nowrap',
                active ? 'text-primary/80' : 'text-muted-foreground/30')}>
              {tk.reading}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {standardLines.map((row, ri) => (
        <div key={ri} className={cn(
          'flex flex-wrap items-end gap-x-1 gap-y-5 sm:gap-y-8 transition-all duration-700',
          active ? 'scale-100 origin-left' : 'opacity-30',
        )}>
          {row.map(renderStdToken)}
        </div>
      ))}
    </div>
  );
};
