"use client"

import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: 'youtube-official' | 'youtube-auto' | 'whisper-groq' | 'lrclib' | 'external' | 'manual' | 'cache' | string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  // Normalise legacy source names stored in old cached results
  const src =
    source === "server-sub"      ? "youtube-official"
    : source === "server-sub-auto" ? "youtube-auto"
    : source;

  const label =
    src === "youtube-official" ? "人工字幕"
    : src === "youtube-auto"   ? "自動字幕"
    : src === "lrclib"         ? "LrcLib 歌詞"
    : src === "whisper-groq"   ? "Whisper 聽寫"
    : src === "external"       ? "Cloud Run"
    : src === "manual"         ? "手動匯入"
    : src === "cache"          ? "⚡ 已快取"
    : src === "genkit-ai"      ? "AI 生成"
    : src;

  const colors =
    src === "youtube-official"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : src === "youtube-auto"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        : src === "lrclib"
          ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
          : src === "whisper-groq"
            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
            : src === "external"
              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
              : src === "manual"
                ? "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
                : src === "cache"
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                  : src === "genkit-ai"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
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
