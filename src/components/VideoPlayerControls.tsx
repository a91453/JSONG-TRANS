"use client"

import React, { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Play, 
  Pause, 
  Pin, 
  PinOff, 
  MessageSquare, 
  Gauge, 
  Repeat,
  Users,
  Lightbulb,
  Mic2
} from "lucide-react"
import { formatTime, formatRate, cn } from "@/lib/utils"

interface VideoPlayerControlsProps {
  currentTime: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  isPinned: boolean
  onTogglePlay: () => void
  onSeek: (percentage: number) => void
  onSetRate: (rate: number) => void
  onTogglePin: () => void
  onExplain: () => void
  onShare: () => void
  isLooping?: boolean
  onToggleLoop?: () => void
  isShadowing?: boolean
  onToggleShadowing?: () => void
}

export function VideoPlayerControls({
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  isPinned,
  onTogglePlay,
  onSeek,
  onSetRate,
  onTogglePin,
  onExplain,
  onShare,
  isLooping = false,
  onToggleLoop,
  isShadowing = false,
  onToggleShadowing
}: VideoPlayerControlsProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localValue, setLocalValue] = useState(0)

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const displayValue = isDragging ? localValue : progress

  return (
    <div className="bg-background text-foreground p-6 pt-2 space-y-6 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t z-20">
      <div className="space-y-1">
        <Slider
          value={[displayValue]}
          max={100}
          step={0.1}
          className="cursor-pointer"
          onValueChange={(val) => {
            setIsDragging(true)
            setLocalValue(val[0])
          }}
          onValueCommit={(val) => {
            setIsDragging(false)
            onSeek(val[0] / 100)
          }}
        />
        <div className="flex justify-between px-1">
          <span className="text-[10px] font-mono text-muted-foreground">{formatTime(currentTime)}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex flex-1 items-center justify-around max-w-sm">
          <ControlButton
            icon={isPinned ? Pin : PinOff}
            label="固定"
            active={isPinned}
            onClick={onTogglePin}
          />
          <ControlButton
            icon={Mic2}
            label="跟讀"
            active={isShadowing}
            onClick={onToggleShadowing || (() => {})}
          />
          <ControlButton
            icon={Repeat}
            label="循環"
            active={isLooping}
            onClick={onToggleLoop || (() => {})} 
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-2 group transition-all">
                <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-muted transition-colors">
                  <Gauge size={22} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{formatRate(playbackRate)}x</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="rounded-2xl">
              {speedOptions.map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => onSetRate(rate)}
                  className="rounded-lg cursor-pointer font-bold"
                >
                  {formatRate(rate)}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ControlButton
            icon={isPlaying ? Pause : Play}
            label={isPlaying ? "暫停" : "播放"}
            onClick={onTogglePlay}
            highlight
          />
        </div>

        <button onClick={onExplain} className="ml-4 w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-primary hover:bg-muted/80 transition-colors shadow-sm active:scale-95">
          <Lightbulb size={24} />
        </button>
      </div>
    </div>
  )
}

function ControlButton({ 
  icon: Icon, 
  label, 
  onClick, 
  active = false,
  highlight = false 
}: { 
  icon: any, 
  label: string, 
  onClick: () => void,
  active?: boolean,
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 group transition-all",
        active ? "text-primary" : "text-foreground"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
        highlight ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "group-hover:bg-muted",
        active && !highlight && "bg-primary/10"
      )}>
        <Icon 
          size={22} 
          className={cn("transition-transform group-hover:scale-110", active && "fill-current")} 
        />
      </div>
      <span className={cn(
        "text-[10px] font-bold tracking-tight transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}>{label}</span>
    </button>
  )
}