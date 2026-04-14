"use client"

import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: 'server-sub' | 'server-sub-auto' | 'whisper-groq' | 'genkit-ai' | 'cache' | 'lrclib' | string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const label =
    source === "server-sub"      ? "人工字幕"
    : source === "server-sub-auto" ? "自動字幕"
    : source === "lrclib"          ? "LrcLib 歌詞"
    : source === "whisper-groq"    ? "Whisper 聽寫"
    : source === "genkit-ai"       ? "AI 生成"
    : source === "cache"           ? "⚡ 已快取"
    : source;

  const colors =
    source === "server-sub"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : source === "server-sub-auto"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        : source === "lrclib"
          ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
          : source === "whisper-groq"
            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
            : source === "cache"
              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
              : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
        colors,
      )}
    >
      {label}
    </span>
  );
}
