"use client"

import { cn } from "@/lib/utils";

export function LoadingSkeleton() {
  return (
    <div className="space-y-6 px-6 py-12 animate-in fade-in duration-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.03]"
        >
          <div className="flex-1 space-y-4">
            <div
              className="h-8 bg-white/10 rounded-xl animate-pulse"
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
            <div
              className="h-4 bg-white/5 rounded-lg animate-pulse"
              style={{ width: `${40 + Math.random() * 20}%` }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
