
"use client"

import React from "react";
import { cn } from "@/lib/utils";

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onFlip?: () => void;
  className?: string;
}

/**
 * 通用 3D 翻轉卡片組件
 * 移植自 Swift CardView，確保旋轉角度僅在 0 與 180 度間切換
 */
export function FlipCard({ front, back, isFlipped, onFlip, className }: FlipCardProps) {
  return (
    <div className={cn("perspective-1000 w-full h-full", className)} onClick={onFlip}>
      <div
        className={cn(
          "relative w-full h-full transition-all duration-500 preserve-3d cursor-pointer",
          isFlipped ? "rotate-y-180" : ""
        )}
      >
        {/* 正面 */}
        <div className="absolute inset-0 backface-hidden bg-card rounded-3xl border shadow-sm flex flex-col items-center justify-center p-6">
          {front}
        </div>

        {/* 反面 */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-card rounded-3xl border shadow-sm flex flex-col items-center justify-center p-6">
          {back}
        </div>
      </div>
    </div>
  );
}
