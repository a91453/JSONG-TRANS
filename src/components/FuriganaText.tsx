
"use client"

import React, { useMemo } from 'react';
import { convertToRomaji } from '@/lib/romaji-utils';
import { cn } from '@/lib/utils';

interface FuriganaItem {
  word: string;
  reading: string;
}

interface FuriganaTextProps {
  text: string;
  furiganaItems: FuriganaItem[];
  showFurigana: boolean;
  showRomaji: boolean;
  showKatakanaReading: boolean;
  /** 每行最多顯示幾個字元（0 = 不限制）*/
  maxCharsPerLine?: number;
  fontSize?: number;
  active?: boolean;
  onWordClick?: (word: string, reading?: string) => void;
}

interface FuriToken {
  text: string;
  reading?: string;
  isAnnotated: boolean;
}

const KANA_RE = /^[぀-ゟ゠-ヿー]$/;

function isPureKatakana(text: string): boolean {
  return /^[゠-ヿー・　\s]+$/.test(text);
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({
  text,
  furiganaItems,
  showFurigana,
  showRomaji,
  showKatakanaReading,
  maxCharsPerLine = 0,
  fontSize = 20,
  active = false,
  onWordClick,
}) => {
  // ── 1. 建立 token 陣列 ───────────────────────────────────────────────────
  const rawTokens = useMemo((): FuriToken[] => {
    let parts: FuriToken[] = [{ text, isAnnotated: false }];
    const sorted = [...furiganaItems].sort((a, b) => b.word.length - a.word.length);

    sorted.forEach(item => {
      const next: FuriToken[] = [];
      parts.forEach(part => {
        if (part.isAnnotated) { next.push(part); return; }
        const split = part.text.split(item.word);
        if (split.length > 1) {
          split.forEach((s, idx) => {
            if (s) next.push({ text: s, isAnnotated: false });
            if (idx < split.length - 1)
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

  // ── 2. 展開非標注文字為單字元 token（修正橫向溢出與假名/漢字羅馬拼音問題）──
  const flatTokens = useMemo((): FuriToken[] =>
    rawTokens.flatMap(tk =>
      tk.isAnnotated
        ? [tk]
        : Array.from(tk.text).map(ch => ({ text: ch, isAnnotated: false }))
    ),
  [rawTokens]);

  // ── 3. 依 maxCharsPerLine 切行 ────────────────────────────────────────────
  const lines = useMemo((): FuriToken[][] => {
    if (maxCharsPerLine <= 0) return [flatTokens];
    const rows: FuriToken[][] = [];
    let cur: FuriToken[] = [];
    let count = 0;
    for (const tk of flatTokens) {
      const len = tk.text.length;
      if (count > 0 && count + len > maxCharsPerLine) {
        rows.push(cur);
        cur = [];
        count = 0;
      }
      cur.push(tk);
      count += len;
    }
    if (cur.length) rows.push(cur);
    return rows;
  }, [flatTokens, maxCharsPerLine]);

  const subFontSize = Math.max(fontSize * 0.55, 12);

  const renderToken = (tk: FuriToken, idx: number) => {
    const reading = tk.reading ?? tk.text;
    const romaji  = convertToRomaji(reading);
    const hasFurigana   = tk.isAnnotated && !!tk.reading;
    const isKanaChar    = !tk.isAnnotated && KANA_RE.test(tk.text);
    const suppressKata  = !showKatakanaReading && tk.isAnnotated && isPureKatakana(tk.text);

    // 羅馬拼音：標注詞有 reading、或單一假名字元（不含漢字）
    const canRomaji    = tk.isAnnotated ? !!tk.reading : isKanaChar;
    const showRomajiLine  = showRomaji   && canRomaji    && !suppressKata;
    const showReadingLine = showFurigana && hasFurigana  && !suppressKata;

    // 單字元非標注 token 縮小水平 padding，避免空隙過寬
    const padX = tk.isAnnotated ? 'px-4' : 'px-0.5';

    return (
      <div
        key={idx}
        className="flex flex-col items-center justify-end cursor-pointer transition-transform hover:scale-105"
        onClick={e => { if (onWordClick) { e.stopPropagation(); onWordClick(tk.text, tk.reading); } }}
      >
        {/* 羅馬拼音 */}
        <div className="h-6 flex items-end justify-center mb-1 w-full">
          {showRomajiLine && (
            <span
              style={{ fontSize: subFontSize * 0.7 }}
              className={cn(
                'font-sans font-black tracking-[0.15em] whitespace-nowrap uppercase opacity-40',
                active ? 'text-primary' : 'text-muted-foreground/30',
              )}
            >
              {romaji}
            </span>
          )}
        </div>

        {/* 日文原文 */}
        <div className={cn(
          `${padX} py-2.5 rounded-[1.2rem] transition-all duration-500`,
          active ? 'bg-primary/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-primary/10' : 'border border-transparent',
        )}>
          <span
            style={{ fontSize: `${fontSize}px` }}
            className={cn(
              'font-bold leading-none tracking-tight block text-center',
              active ? 'text-foreground' : 'text-muted-foreground/10',
            )}
          >
            {tk.text}
          </span>
        </div>

        {/* 讀音假名 */}
        <div className="h-6 flex items-start justify-center mt-1.5 w-full">
          {showReadingLine && (
            <span
              style={{ fontSize: subFontSize }}
              className={cn(
                'font-sans font-bold whitespace-nowrap',
                active ? 'text-primary/80' : 'text-muted-foreground/30',
              )}
            >
              {tk.reading}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {lines.map((row, ri) => (
        <div
          key={ri}
          className={cn(
            'flex flex-wrap items-end gap-x-1 gap-y-5 sm:gap-y-8 transition-all duration-700',
            active ? 'scale-100 origin-left' : 'opacity-30',
          )}
        >
          {row.map(renderToken)}
        </div>
      ))}
    </div>
  );
};
