"use client"

import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: 'youtube-official' | 'youtube-auto' | 'whisper-groq' | 'lrclib' | 'external' | 'manual' | 'cache' | string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const label =
    source === "youtube-official" ? "人工字幕"
    : source === "youtube-auto"   ? "自動字幕"
    : source === "lrclib"         ? "LrcLib 歌詞"
    : source === "whisper-groq"   ? "Whisper 聽寫"
    : source === "external"       ? "Cloud Run"
    : source === "manual"         ? "手動匯入"
    : source === "cache"          ? "⚡ 已快取"
    : source;

  const colors =
    source === "youtube-official"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : source === "youtube-auto"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        : source === "lrclib"
          ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
          : source === "whisper-groq"
            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
            : source === "external"
              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
              : source === "manual"
                ? "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
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
