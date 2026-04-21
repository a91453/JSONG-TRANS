
"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import YouTube, { YouTubeProps } from 'react-youtube'
import { FuriganaText, AnnotationMode } from "@/components/FuriganaText"
import { VideoPlayerControls } from "@/components/VideoPlayerControls"
import { LoadingSkeleton } from "@/components/LoadingSkeleton"
import { SourceBadge } from "@/components/SourceBadge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { 
  useDictionaryStore, 
  useFavoriteStore,
  useSettingsStore
} from "@/store/use-app-store"
import { useAnalyzeStream } from "@/hooks/use-analyze-stream"
import { cn, formatTime } from "@/lib/utils"
import {
  PlusCircle,
  PlayCircle,
  Star,
  Loader2,
  RotateCcw,
  Info,
  Repeat,
  MoreVertical,
  Share2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Download,
  LogIn,
  FileUp,
} from "lucide-react"
import { Segment } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { convertToRomaji } from "@/lib/romaji-utils"
import { explainSentenceAction, type ExplainOutput } from "@/ai/flows/explain-sentence"
import { annotateSegmentsAction, annotateFuriganaOnlyAction } from "@/ai/flows/analyze-video"
import { speak } from "@/lib/speech"
import { generateSRT, parseSRT, parseTXT } from "@/lib/subtitle-utils"
import { useHistoryStore } from "@/store/use-app-store"

function LearnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const v = searchParams.get('v') || ""
  
  const settings = useSettingsStore()
  const [player, setPlayer] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isPinned, setIsPinned] = useState(false)
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>(settings.defaultAnnotation)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  
  const [loopingSegmentId, setLoopingSegmentId] = useState<string | null>(null)
  const [loopCounter, setLoopCounter] = useState(0)
  const [isShadowing, setIsShadowing] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null)
  
  const [captionOffset, setCaptionOffset] = useState(0)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explainData, setExplainData] = useState<ExplainOutput | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importText, setImportText]     = useState("")
  const [isImporting, setIsImporting]   = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()
  const { addEntry, addAllFromSegment, contains: dictContains } = useDictionaryStore()
  const { saveResult } = useHistoryStore()
  const { addFavorite, isFavorited } = useFavoriteStore()
  const {
    response, streamedSegments, isLoading, isSigningIn,
    errorMessage, loadingStage, videoTitle, artistName,
    needGoogleAuth, analyze, handleGoogleSignIn, dismissGoogleAuth,
  } = useAnalyzeStream()

  const isValidVideoId = v && (v.length === 11 || v.startsWith('custom_') || v.startsWith('file-'))
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // isLoading 防護：避免 setResponse(null) 觸發重複呼叫
    if (isValidVideoId && !response && !isLoading) {
      analyze(v)
    }
  }, [v, isValidVideoId, analyze, response, isLoading])

  useEffect(() => {
    setAnnotationMode(settings.defaultAnnotation)
  }, [settings.defaultAnnotation])

  // streamedSegments grows batch-by-batch during SSE; falls back to response.segments on cache hit
  const segments = streamedSegments.length > 0 ? streamedSegments : (response?.segments ?? [])

  const onReady: YouTubeProps['onReady'] = (event) => {
    setPlayer(event.target)
    setDuration(event.target.getDuration())
  }

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    setIsPlaying(event.data === 1)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (player && isPlaying) {
      interval = setInterval(() => {
        const time = player.getCurrentTime()
        setCurrentTime(time)
        
        const active = segments.find(s => time >= s.start + captionOffset && time < s.end + captionOffset)
        if (active && active.id !== activeSegmentId) {
          setActiveSegmentId(active.id)
          if (!isPinned) {
            const el = document.getElementById(`segment-${active.id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }

        if (loopingSegmentId) {
          const loopSeg = segments.find(s => s.id === loopingSegmentId)
          if (loopSeg && time >= loopSeg.end + captionOffset - 0.1) {
            const maxLoops = settings.loopCount
            if (loopCounter + 1 < maxLoops) {
              setLoopCounter(prev => prev + 1)
              player.seekTo(loopSeg.start + captionOffset, true)
            } else {
              setLoopingSegmentId(null)
              setLoopCounter(0)
              if (isShadowing) player.pauseVideo()
            }
          }
        } else if (isShadowing) {
          const currentSeg = segments.find(s => time >= s.end + captionOffset - 0.1 && time <= s.end + captionOffset + 0.1)
          if (currentSeg) {
            player.pauseVideo()
          }
        }
      }, 100) 
    }
    return () => clearInterval(interval)
  }, [player, isPlaying, segments, activeSegmentId, isPinned, loopingSegmentId, loopCounter, isShadowing, settings.loopCount, captionOffset])

  const handleSeek = (percentage: number) => {
    if (player) player.seekTo(duration * percentage, true)
  }

  const handleSeekToSegment = (seg: Segment) => {
    if (player) {
      player.seekTo(seg.start + captionOffset, true)
      player.playVideo()
      setActiveSegmentId(seg.id)
      setLoopCounter(0)
    }
  }

  const toggleLoop = (segId: string) => {
    if (loopingSegmentId === segId) {
      setLoopingSegmentId(null)
      setLoopCounter(0)
    } else {
      setLoopingSegmentId(segId)
      setLoopCounter(0)
      if (player) player.seekTo((segments.find(s => s.id === segId)?.start || 0) + captionOffset, true)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleExplainAI = async (
    sentence: string,
    context?: { focusWord?: string; focusReading?: string; songTitle?: string }
  ) => {
    const provider = settings.aiProvider;
    const apiKey = provider === 'google' ? settings.geminiApiKey : settings.groqApiKey;
    const model = provider === 'google' ? settings.geminiModel : settings.groqModel;

    if (!apiKey) {
      toast({ variant: "destructive", title: "缺少 API Key", description: "請先在設定中完成配置。" });
      return;
    }

    setIsExplaining(true)
    setExplainData(null)
    try {
      const data = await explainSentenceAction(sentence, { provider, apiKey, model }, context)
      setExplainData(data)
    } catch (e: any) {
      console.error('Error in handleExplainAI:', e);
      const msg = e.message || "";
      if (msg.includes("429") || msg.includes("Quota") || msg.includes("limit")) {
        toast({ variant: "destructive", title: "API 請求頻繁", description: "配額已滿，請稍候 30 秒再試一次。" })
      } else {
        toast({ variant: "destructive", title: "AI 解析失敗", description: "請檢查網路或 API Key 設定。" })
      }
    } finally {
      setIsExplaining(false)
    }
  }

  // 點擊含漢字的詞 → 朗讀 + 觸覺 + AI 深度解說（傳入整句與歌曲上下文）
  const handleWordClick = (word: string, reading?: string, seg?: Segment) => {
    speak(word);
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
    if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(word) && seg) {
      handleExplainAI(seg.japanese, {
        focusWord:    word,
        focusReading: reading,
        songTitle:    videoTitle || undefined,
      });
    }
  }

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string)
      toast({ title: "檔案已載入", description: file.name })
    }
    reader.readAsText(file)
    if (e.target) e.target.value = ""
  }

  const handleManualImport = async () => {
    if (!importText.trim()) return
    const provider = settings.aiProvider
    const apiKey   = provider === 'google' ? settings.geminiApiKey : settings.groqApiKey
    if (!apiKey) {
      toast({ variant: "destructive", title: "缺少 API Key", description: "請先在設定中配置 API Key。" })
      return
    }
    setIsImporting(true)
    setIsImportDialogOpen(false)
    try {
      const parsed = importText.includes("-->") ? parseSRT(importText) : parseTXT(importText)
      if (parsed.length === 0) throw new Error("無法解析文字，請確認格式（SRT 含時間軸，或純文字每行一句）。")
      const aiConfig = { provider, apiKey, model: provider === 'google' ? settings.geminiModel : settings.groqModel }
      const isBilingual = parsed.every(s => s.translation)
      const result = isBilingual
        ? await annotateFuriganaOnlyAction(
            parsed as Array<{ start: number; end: number; text: string; translation: string }>,
            aiConfig
          )
        : await annotateSegmentsAction(parsed, aiConfig)
      const videoId     = v.length === 11 ? v : `file-${Date.now()}`
      const finalResult = { ...result, videoId }
      saveResult(finalResult, videoTitle || "匯入字幕", artistName || "自定義")
      toast({ title: "匯入完成", description: `${result.segments.length} 段字幕已就緒。` })
      if (videoId !== v) {
        router.push(`/learn?v=${videoId}`)
      } else {
        analyze(v, false)
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "匯入失敗", description: err.message })
    } finally {
      setIsImporting(false)
    }
  }

  const handleShare = () => {
    if (!response) return;
    let text = `🎵 ${videoTitle}\n${artistName ? `🎤 ${artistName}\n` : ""}\n`;
    response.segments.forEach(seg => {
      text += `[${formatTime(seg.start)}] ${seg.japanese}\n  → ${seg.translation}\n`;
    });
    navigator.clipboard.writeText(text);
    toast({ title: "已複製逐字稿" });
  }

  const handleDownloadSRT = () => {
    if (!response) return;
    const srt = generateSRT(response.segments);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle || 'subtitles'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "SRT 已下載", description: `${response.segments.length} 段字幕` });
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-6 p-8 text-center bg-background">
        <AlertTriangle size={60} className="text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-bold">解析發生錯誤</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => analyze(v)} className="rounded-xl">重試一次</Button>
          <Button onClick={() => router.push('/settings')} variant="outline" className="rounded-xl">檢查 API 設定</Button>
        </div>
      </div>
    )
  }

  // Initial loading: no segments yet — show full-screen spinner
  if (isLoading && segments.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <div className="w-full bg-black aspect-video flex items-center justify-center border-b">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-xs font-black tracking-widest text-primary uppercase animate-pulse">{loadingStage}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  const playerControls = (
    <VideoPlayerControls
      currentTime={currentTime}
      duration={duration}
      isPlaying={isPlaying}
      playbackRate={playbackRate}
      isPinned={isPinned}
      onTogglePlay={() => { if (player) { if (isPlaying) player.pauseVideo(); else player.playVideo(); } }}
      onSeek={handleSeek}
      onSetRate={(rate) => { player?.setPlaybackRate(rate); setPlaybackRate(rate); }}
      onTogglePin={() => setIsPinned(!isPinned)}
      onExplain={() => { const active = segments.find(s => s.id === activeSegmentId); if (active) handleExplainAI(active.japanese, { songTitle: videoTitle || undefined }); }}
      onShare={handleShare}
      isLooping={!!loopingSegmentId}
      onToggleLoop={() => { if (activeSegmentId) toggleLoop(activeSegmentId); }}
      isShadowing={isShadowing}
      onToggleShadowing={() => { setIsShadowing(!isShadowing); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); }}
    />
  )

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background text-foreground overflow-hidden">
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* ── Left panel (mobile: top section) ──────────────────────── */}
        <div className="md:w-[380px] lg:w-[420px] shrink-0 flex flex-col md:border-r overflow-hidden">
          <div className="w-full bg-black aspect-video max-h-[28vh] md:max-h-none relative z-10">
            {v && v.length === 11 ? (
              <YouTube
                videoId={v}
                className="w-full h-full"
                iframeClassName="w-full h-full"
                onReady={onReady}
                onStateChange={onStateChange}
                opts={{ playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, enablejsapi: 1, playsinline: 1 } }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-4">
                <PlayCircle size={64} className="opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-40">自定義匯入課程</p>
              </div>
            )}
          </div>

          <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/20">
            <div className="min-w-0 flex-1 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xs font-black truncate text-foreground/80 tracking-wider uppercase">{videoTitle}</h1>
                {response?.source && <SourceBadge source={response.source} />}
              </div>
              <p className="text-[10px] text-primary font-bold truncate">{artistName || "YouTube"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { const seg = segments.find(s => s.id === activeSegmentId); if (seg) handleExplainAI(seg.japanese); }} className="p-2 hover:bg-primary/10 rounded-full transition-colors text-primary"><Lightbulb size={20} /></button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-muted rounded-full transition-colors"><MoreVertical size={18} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl">
                  <DropdownMenuItem onClick={handleShare}><Share2 className="mr-2 h-4 w-4" /> 分享逐字稿</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadSRT}><Download className="mr-2 h-4 w-4" /> 下載 SRT 字幕</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}><FileUp className="mr-2 h-4 w-4" /> 手動匯入字幕</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => analyze(v, true)} className="text-accent"><RotateCcw className="mr-2 h-4 w-4" /> 重新分析</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isLoading && segments.length > 0 && (
            <div className="px-4 py-1.5 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              <p className="text-[10px] text-primary font-black uppercase tracking-widest animate-pulse">{loadingStage}</p>
              <span className="ml-auto text-[9px] text-primary/60 font-bold tabular-nums">{segments.length} 段</span>
            </div>
          )}

          {response?.source === 'lrclib' && (
            <div className="px-4 py-2 bg-teal-50/80 dark:bg-teal-900/20 border-b border-teal-100/60 flex items-center gap-2">
              <Info size={12} className="text-teal-600 shrink-0" />
              <p className="text-[10px] text-teal-700 dark:text-teal-300 font-medium leading-tight">
                LrcLib 時間軸依純音檔計算，YouTube MV 若有前奏請用下方 ＋/－ 調整偏移
              </p>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar bg-muted/10 border-b">
            {(['furigana', 'romaji', 'both', 'none'] as AnnotationMode[]).map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full h-7 px-3 text-[10px] font-black shrink-0 uppercase tracking-widest",
                  annotationMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
                onClick={() => { setAnnotationMode(mode); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5); }}
              >
                {mode === 'furigana' && "假名"}
                {mode === 'romaji' && "拼音"}
                {mode === 'both' && "完整"}
                {mode === 'none' && "隱藏"}
              </Button>
            ))}
            <div className="w-px h-4 bg-border shrink-0 mx-1" />
            <button
              onClick={() => setCaptionOffset(prev => +(prev - 0.5).toFixed(1))}
              className="h-7 px-2.5 rounded-full text-[10px] font-black bg-muted/40 hover:bg-muted text-muted-foreground shrink-0 transition-colors"
            >
              −
            </button>
            <span className={cn(
              "text-[10px] font-black tabular-nums min-w-[36px] text-center shrink-0",
              captionOffset !== 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {captionOffset >= 0 ? `+${captionOffset.toFixed(1)}` : captionOffset.toFixed(1)}s
            </span>
            <button
              onClick={() => setCaptionOffset(prev => +(prev + 0.5).toFixed(1))}
              className="h-7 px-2.5 rounded-full text-[10px] font-black bg-muted/40 hover:bg-muted text-muted-foreground shrink-0 transition-colors"
            >
              +
            </button>
            {captionOffset !== 0 && (
              <button
                onClick={() => setCaptionOffset(0)}
                className="h-7 px-2 rounded-full text-[9px] font-black text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              >
                重置
              </button>
            )}
          </div>

          {/* Desktop: player controls pinned to bottom of left panel */}
          <div className="hidden md:block mt-auto border-t">
            {playerControls}
          </div>
        </div>

        {/* ── Right panel: lyrics scroll area ────────────────────────── */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 no-scrollbar scroll-smooth bg-gradient-to-b from-background to-muted/5">
          <div className="py-8 space-y-4 md:space-y-6 pb-16">
            {segments.map((seg, idx) => {
              const isActive = activeSegmentId === seg.id
              const isFav = isFavorited(v, seg.start)
              const isLooping = loopingSegmentId === seg.id
              return (
                <div
                  key={`${seg.id}-${idx}`}
                  id={`segment-${seg.id}`}
                  onClick={() => handleSeekToSegment(seg)}
                  className={cn(
                    "p-5 rounded-[2rem] transition-all duration-700 cursor-pointer relative group border-2 bg-card",
                    isActive
                      ? "border-primary/20 scale-100 shadow-[0_10px_40px_rgba(0,0,0,0.05)]"
                      : "border-transparent scale-[0.98] opacity-50 hover:opacity-90"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <FuriganaText
                      text={seg.japanese}
                      furiganaItems={seg.furigana}
                      mode={annotationMode}
                      fontSize={settings.lyricsFontSize}
                      active={isActive}
                      onWordClick={(word, reading) => handleWordClick(word, reading, seg)}
                    />
                    {settings.showTranslation && (
                      <p className={cn(
                        "text-sm transition-all duration-500 tracking-wide",
                        isActive ? "text-foreground font-bold" : "text-muted-foreground font-medium"
                      )}>
                        {seg.translation}
                      </p>
                    )}
                  </div>

                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => { e.stopPropagation(); addFavorite(seg, v, videoTitle, artistName); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); }} className={cn("w-9 h-9 rounded-full flex items-center justify-center bg-background/80 shadow-sm border", isFav ? "text-yellow-500" : "text-muted-foreground hover:text-primary")}>
                      <Star size={18} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleLoop(seg.id); }} className={cn("w-9 h-9 rounded-full flex items-center justify-center bg-background/80 shadow-sm border", isLooping ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                      <Repeat size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedSegment(seg); }} className="w-9 h-9 rounded-full flex items-center justify-center bg-background/80 shadow-sm border text-muted-foreground hover:text-primary">
                      <Info size={18} />
                    </button>
                  </div>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary rounded-r-full shadow-lg animate-pulse" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile: player controls at page bottom */}
      <div className="md:hidden">
        {playerControls}
      </div>

      <Dialog open={!!selectedSegment} onOpenChange={(open) => !open && setSelectedSegment(null)}>
        <DialogContent className="rounded-[3rem] max-w-sm bg-background shadow-2xl">
          <DialogHeader><DialogTitle className="text-center font-black text-2xl uppercase tracking-tighter">單字清單</DialogTitle></DialogHeader>
          {selectedSegment && (
            <div className="space-y-8 py-6">
              <div className="p-6 bg-muted/30 rounded-[2rem] border border-border">
                <FuriganaText text={selectedSegment.japanese} furiganaItems={selectedSegment.furigana} mode={annotationMode} fontSize={22} active onWordClick={(word, reading) => handleWordClick(word, reading, selectedSegment)} />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">單字解析</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-primary font-black text-[10px]" onClick={() => { addAllFromSegment(selectedSegment, v, videoTitle || "影片課程"); toast({ title: "已全部加入字典" }); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20); }}>全部加入</Button>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 no-scrollbar">
                  {selectedSegment.furigana.map((item, fIdx) => {
                    const saved = dictContains(item.word, item.reading)
                    return (
                      <div key={fIdx} className="flex items-center justify-between p-5 bg-card rounded-2xl border hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-5">
                          <span className="text-2xl font-black text-primary">{item.word}</span>
                          <div className="flex flex-col"><span className="text-xs font-bold text-muted-foreground">{item.reading}</span><span className="text-[10px] text-accent font-black uppercase tracking-tighter opacity-60">{convertToRomaji(item.reading)}</span></div>
                        </div>
                        <button onClick={() => { if (!saved) { addEntry(item.word, item.reading, v, videoTitle, selectedSegment.japanese, selectedSegment.translation); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } }} className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all", saved ? "text-green-500 bg-green-500/10" : "text-primary bg-primary/10 hover:scale-110")}>
                          <PlusCircle size={24} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 手動匯入字幕 ───────────────────────────────────────────────── */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">AI 標注中…</p>
          </div>
        </div>
      )}

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter uppercase text-center">手動匯入字幕</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground font-medium">貼上 SRT 字幕或純文字歌詞</p>
              <div className="flex gap-2">
                <input type="file" ref={importFileRef} onChange={handleImportFileSelect} accept=".srt,.txt" className="hidden" />
                <Button variant="secondary" size="sm" className="h-7 rounded-lg text-[10px] font-black gap-1.5" onClick={() => importFileRef.current?.click()}>
                  <FileUp size={12} /> 從檔案載入
                </Button>
              </div>
            </div>
            <Textarea
              placeholder={"貼上 SRT 字幕或日文歌詞...\n（支援純文字或 .srt 格式）"}
              className="min-h-[200px] rounded-2xl text-sm font-medium p-4 bg-muted/20 border-none resize-none focus-visible:ring-primary/20"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90"
              disabled={!importText.trim() || isImporting}
              onClick={handleManualImport}
            >
              確認匯入並分析
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Google 登入 Modal（YouTube 封鎖 GCP IP 時觸發）─────────────── */}
      <Dialog open={needGoogleAuth} onOpenChange={(open) => !open && dismissGoogleAuth()}>
        <DialogContent className="rounded-[3rem] max-w-sm bg-background shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center font-black text-xl uppercase tracking-tighter">
              YouTube 需要驗證
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3 text-center">
              <p className="text-sm font-bold text-foreground/80">
                語音轉錄服務所在的伺服器被 YouTube 限流。
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                以 Google 帳號登入後，App 會取得一組短期憑證傳給伺服器，讓 YouTube 認可這是正常的存取請求。
                憑證僅用於本次下載，50 分鐘後自動失效，且不會被儲存至伺服器。
              </p>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full rounded-2xl font-black"
                onClick={() => handleGoogleSignIn(v)}
                disabled={isSigningIn}
              >
                {isSigningIn
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 登入中…</>
                  : <><LogIn className="mr-2 h-4 w-4" /> 以 Google 帳號繼續</>
                }
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-2xl text-muted-foreground font-bold text-xs"
                onClick={dismissGoogleAuth}
              >
                略過（使用 AI 生成，時間軸可能不準）
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExplaining || !!explainData} onOpenChange={(open) => !open && setExplainData(null)}>
        <DialogContent className="rounded-[3rem] max-w-sm bg-background shadow-2xl overflow-y-auto max-h-[85vh] no-scrollbar">
          <DialogHeader><DialogTitle className="text-center font-black text-2xl tracking-tighter uppercase">AI 深度解說</DialogTitle></DialogHeader>
          {isExplaining ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6"><Loader2 className="animate-spin text-primary" size={48} /><p className="text-sm font-bold text-muted-foreground animate-pulse">正在解析文法奧秘...</p></div>
          ) : explainData && (
            <div className="space-y-8 py-4">
              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} /> 句子結構拆解</h3>
                <div className="grid grid-cols-1 gap-2">
                  {explainData.breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-primary">{item.token}</span>
                        {item.reading && <span className="text-[10px] font-medium text-muted-foreground">{item.reading}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{item.partOfSpeech}</span>
                        <p className="text-xs font-medium mt-1">{item.meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Lightbulb size={14} /> 關鍵文法點</h3>
                <div className="space-y-3">
                  {explainData.grammarPoints.map((gp, i) => (
                    <div key={i} className="p-4 bg-primary/5 rounded-2xl border border-primary/10"><p className="text-sm font-bold text-primary mb-1">{gp.point}</p><p className="text-xs text-muted-foreground leading-relaxed">{gp.explanation}</p></div>
                  ))}
                </div>
              </section>
              {explainData.cultureNote && (
                <section className="p-4 bg-orange-50 rounded-2xl border border-orange-100"><h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">💡 語境補充</h3><p className="text-xs text-orange-900 leading-relaxed">{explainData.cultureNote}</p></section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><Loader2 className="animate-spin text-primary" /></div>}>
      <LearnContent />
    </Suspense>
  )
}
