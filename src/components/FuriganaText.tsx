
"use client"

import React, { useMemo } from 'react';
import { convertToRomaji } from '@/lib/romaji-utils';
import { cn } from '@/lib/utils';

export type AnnotationMode = 'furigana' | 'romaji' | 'both' | 'none';

interface FuriganaItem {
  word: string;
  reading: string;
}

interface FuriganaTextProps {
  text: string;
  furiganaItems: FuriganaItem[];
  mode: AnnotationMode;
  fontSize?: number;
  active?: boolean;
  onWordClick?: (word: string, reading?: string) => void;
}

interface FuriToken {
  text: string;
  reading?: string;
  isAnnotated: boolean;
}

/**
 * @fileOverview 歌詞標註組件 - 垂直三層排版加強版
 * 視覺層級（由上至下）：
 * 1. Top: 羅馬拼音 (Romaji) - 輕量化輔助，增加字距
 * 2. Middle: 日文原文 (視覺重心) - 顯著放大，具備微背景對齊感
 * 3. Bottom: 振假名 (Furigana) - 緊貼原文下方
 */
export const FuriganaText: React.FC<FuriganaTextProps> = ({ 
  text, 
  furiganaItems, 
  mode, 
  fontSize = 20,
  active = false,
  onWordClick
}) => {
  const tokens = useMemo((): FuriToken[] => {
    let parts: FuriToken[] = [{ text: text, isAnnotated: false }];
    const sortedItems = [...furiganaItems].sort((a, b) => b.word.length - a.word.length);

    sortedItems.forEach(item => {
      const nextParts: FuriToken[] = [];
      parts.forEach(part => {
        if (part.isAnnotated) {
          nextParts.push(part);
          return;
        }
        const split = part.text.split(item.word);
        if (split.length > 1) {
          split.forEach((s, idx) => {
            if (s) nextParts.push({ text: s, isAnnotated: false });
            if (idx < split.length - 1) {
              nextParts.push({ text: item.word, reading: item.reading, isAnnotated: true });
            }
          });
        } else {
          nextParts.push(part);
        }
      });
      parts = nextParts;
    });
    return parts;
  }, [text, furiganaItems]);
  const subFontSize = Math.max(fontSize * 0.55, 12);

  return (
    <div className={cn(
      "flex flex-wrap items-end gap-x-2 gap-y-5 sm:gap-y-8 transition-all duration-700",
      active ? "scale-100 origin-left" : "opacity-30"
    )}>
      {tokens.map((tk, idx) => {
        const reading = tk.reading || tk.text;
        const romaji = convertToRomaji(reading);
        const hasFurigana = tk.isAnnotated && !!tk.reading;

        return (
          <div 
            key={idx} 
            className="flex flex-col items-center justify-end group cursor-pointer transition-transform hover:scale-105"
            onClick={(e) => {
              if (onWordClick) {
                e.stopPropagation();
                onWordClick(tk.text, tk.reading);
              }
            }}
          >
            {/* 層級 1：羅馬拼音 (Top) - 輔助導引 */}
            <div className="h-6 flex items-end justify-center mb-1 w-full">
              {(mode === 'romaji' || mode === 'both') && (
                <span 
                  style={{ fontSize: subFontSize * 0.7 }} 
                  className={cn(
                    "font-sans font-black tracking-[0.25em] whitespace-nowrap px-1 uppercase opacity-40",
                    active ? "text-primary" : "text-muted-foreground/30"
                  )}
                >
                  {romaji}
                </span>
              )}
            </div>

            {/* 層級 2：日文原文 (Middle - 視覺焦點) */}
            <div className={cn(
              "px-4 py-2.5 rounded-[1.2rem] transition-all duration-500",
              active ? "bg-primary/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-primary/10" : "border border-transparent"
            )}>
              <span
                style={{ fontSize: `${fontSize}px` }}
                className={cn(
                  "font-bold leading-none tracking-tight block text-center",
                  active ? "text-foreground" : "text-muted-foreground/10"
                )}
              >
                {tk.text}
              </span>
            </div>

            {/* 層級 3：振假名 (Bottom) - 發音提示 */}
            <div className="h-6 flex items-start justify-center mt-1.5 w-full">
              {(mode === 'furigana' || mode === 'both') && hasFurigana && (
                <span 
                  style={{ fontSize: subFontSize }} 
                  className={cn(
                    "font-sans font-bold",
                    active ? "text-primary/80" : "text-muted-foreground/30"
                  )}
                >
                  {tk.reading}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
