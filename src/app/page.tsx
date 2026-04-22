
"use client"

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  useStreakStore, 
  useHistoryStore, 
  useDictionaryStore, 
  useFavoriteStore,
  useSettingsStore
} from "@/store/use-app-store";
import { extractVideoID, fetchYouTubeInfo } from "@/lib/youtube";
import { parseSRT, parseTXT } from "@/lib/subtitle-utils";
import { fetchYouTubeSRT } from "@/lib/youtube-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Link as LinkIcon, 
  Flame, 
  BookOpen, 
  Star, 
  ChevronRight, 
  PlayCircle, 
  Clock, 
  Quote,
  XCircle,
  Zap,
  Book,
  Layers,
  RotateCcw,
  FileUp,
  Loader2,
  Type,
  PlusCircle,
  FileText,
  Info,
  Settings,
  AlertTriangle
} from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import { annotateSegmentsAction, annotateFuriganaOnlyAction } from "@/ai/flows/analyze-video";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [youtubeLink, setYoutubeLink] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isFetchingSRT, setIsFetchingSRT] = useState(false);
  const [manualText, setManualText] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settings = useSettingsStore();
  const { streak, checkIn } = useStreakStore();
  const { items: historyItems, removeByVideoId, saveResult } = useHistoryStore();
  const { entries } = useDictionaryStore();
  const unmasteredCount = entries.filter(e => !e.mastered).length;
  const { items: favoriteItems } = useFavoriteStore();

  useEffect(() => {
    setIsMounted(true);
    checkIn();
  }, [checkIn]);

  // API Key 檢測邏輯
  const hasApiKey = useMemo(() => {
    if (settings.aiProvider === 'google') return !!settings.geminiApiKey;
    return !!settings.groqApiKey;
  }, [settings.aiProvider, settings.geminiApiKey, settings.groqApiKey]);

  const parsedVideoID = useMemo(() => extractVideoID(youtubeLink), [youtubeLink]);

  const handleImportYT = () => {
    if (!hasApiKey) {
      toast({ variant: "destructive", title: "尚未設定 API Key", description: "請前往設定頁面輸入您的 AI 供應商金鑰以啟用分析功能。" });
      router.push('/settings');
      return;
    }
    if (parsedVideoID) {
      router.push(`/learn?v=${parsedVideoID}`);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualText.trim()) return;
    if (!hasApiKey) {
      toast({ variant: "destructive", title: "尚未設定 API Key", description: "請前往設定頁面輸入您的 AI 供應商金鑰以啟用分析功能。" });
      router.push('/settings');
      return;
    }

    setIsImporting(true);
    setIsImportDialogOpen(false);
    
    try {
      const videoId = parsedVideoID || `file-${Date.now()}`;
      let title = "手動匯入課程";
      let author = "自定義內容";

      if (parsedVideoID) {
        const info = await fetchYouTubeInfo(parsedVideoID);
        title = info?.title || title;
        author = info?.author || author;
      }

      const parsed = manualText.includes("-->") ? parseSRT(manualText) : parseTXT(manualText);

      if (parsed.length === 0) throw new Error("無法解析文字內容，請確認格式（SRT 含時間軸，或純文字每行一句）。");

      const aiConfig = {
        provider: settings.aiProvider,
        apiKey:   settings.aiProvider === 'google' ? settings.geminiApiKey : settings.groqApiKey,
        model:    settings.aiProvider === 'google' ? settings.geminiModel  : settings.groqModel,
      };

      const isBilingual = parsed.every(s => s.translation);
      toast({
        title:       "開始處理",
        description: isBilingual
          ? "雙語 SRT 偵測成功，僅需標注振假名…"
          : "正在進行 AI 標注與翻譯…",
      });

      const result = isBilingual
        ? await annotateFuriganaOnlyAction(
            parsed as Array<{ start: number; end: number; text: string; translation: string }>,
            aiConfig
          )
        : await annotateSegmentsAction(parsed, aiConfig);
      const finalResult = { ...result, videoId };
      
      saveResult(finalResult, title, author);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
      router.push(`/learn?v=${videoId}`);
    } catch (err: any) {
      console.error('Error in handleManualSubmit:', err);
      toast({ variant: "destructive", title: "處理失敗", description: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFetchYouTubeSRT = async () => {
    if (!parsedVideoID) return;
    setIsFetchingSRT(true);
    try {
      const result = await fetchYouTubeSRT(parsedVideoID);
      if (!result) {
        toast({ variant: "destructive", title: "無可用字幕", description: "此影片沒有日文字幕，請手動貼上歌詞。" });
        return;
      }
      setManualText(result.srt);
      setIsImportDialogOpen(true);
      toast({
        title: `已擷取 ${result.count} 段字幕`,
        description: result.isAuto ? "自動生成字幕（精確度較低）" : "官方字幕"
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "擷取失敗", description: err.message });
    } finally {
      setIsFetchingSRT(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setManualText(content);
      toast({ title: "檔案已載入", description: `已讀取 ${file.name}，您可以點擊確認開始分析。` });
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-full bg-background px-6 pt-6 space-y-8 max-w-2xl mx-auto pb-24">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-headline font-bold text-foreground">學習中心</h1>
          <div className="flex items-center gap-1 bg-primary/10 px-3 py-1 rounded-full">
            <Zap size={14} className="text-primary fill-primary" />
            <span className="text-[10px] font-black text-primary uppercase">Pro v1.1</span>
          </div>
        </div>
        
        {/* API Key 狀態提示區塊 - 改進引導視覺 */}
        {!hasApiKey && (
          <div className="w-full bg-red-50 border-2 border-red-200 rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-xl border-4 border-red-50">
              <AlertTriangle size={48} className="text-red-500 animate-bounce" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-black text-red-900 uppercase tracking-tight">AI 功能尚未啟動</p>
              <p className="text-sm text-red-700 font-bold opacity-80 leading-relaxed max-w-xs">
                我們需要您的 API Key 才能進行日文標註與翻譯。請點擊下方按鈕前往設定。
              </p>
            </div>
            <Link href="/settings" className="w-full">
              <Button size="lg" variant="destructive" className="w-full rounded-[1.5rem] h-16 px-8 text-base font-black uppercase tracking-widest shadow-2xl hover:scale-[1.02] transition-all">
                <Settings className="mr-3" size={20} /> 立即設定 API Key
              </Button>
            </Link>
          </div>
        )}

        <div className="w-full bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <Flame size={20} className="text-orange-500 fill-orange-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-900">連續學習 {streak.current} 天</p>
            <p className="text-[10px] text-orange-700 font-medium opacity-70">最長紀錄 {streak.longest} 天</p>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">快速開始</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/kana-grid" className="group">
            <Card className="border-none bg-indigo-600 text-white shadow-lg h-36 rounded-[2rem] overflow-hidden relative active:scale-95 transition-all">
              <CardContent className="h-full flex flex-col items-center justify-center p-0">
                <span className="text-5xl font-bold mb-1 drop-shadow-md">あ</span>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">五十音基礎</span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/practice" className="group">
            <Card className="border-none bg-teal-500 text-white shadow-lg h-36 rounded-[2rem] overflow-hidden relative active:scale-95 transition-all">
              <CardContent className="h-full flex flex-col items-center justify-center p-0">
                <Layers size={40} className="mb-2 drop-shadow-md" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">單字實驗室</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dictionary" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-border/50 shadow-sm hover:bg-muted/30 active:scale-[0.98] transition-all group">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md">
            <Book size={20} fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs truncate text-foreground">我的字典</h4>
            <p className="text-[9px] font-bold text-orange-600 truncate">{unmasteredCount} 待複習</p>
          </div>
        </Link>

        <Link href="/favorites" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-border/50 shadow-sm hover:bg-muted/30 active:scale-[0.98] transition-all group">
          <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-white shadow-md">
            <Star size={20} fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs truncate text-foreground">收藏句子</h4>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">{favoriteItems.length} 句</p>
          </div>
        </Link>
      </div>

      <section className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-headline font-bold">影音沉浸解析</h2>
          {isImporting && (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[10px] font-black uppercase">AI 解析中...</span>
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <LinkIcon size={18} />
            </div>
            <Input
              placeholder="貼上 YouTube 網址..."
              className="pl-11 pr-28 h-14 rounded-2xl bg-muted/30 border-none shadow-inner text-sm font-medium placeholder:text-muted-foreground/60"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
            />
            <Button
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95",
                parsedVideoID ? "bg-primary text-white" : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              disabled={!parsedVideoID || isImporting}
              onClick={handleImportYT}
            >
              分析
            </Button>
          </div>

          {parsedVideoID && (
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border-dashed border-muted-foreground/30 text-muted-foreground font-bold gap-2 hover:bg-muted/20 text-xs active:scale-[0.99] transition-all"
              disabled={isFetchingSRT || isImporting}
              onClick={handleFetchYouTubeSRT}
            >
              {isFetchingSRT
                ? <><Loader2 size={14} className="animate-spin" /> 擷取字幕中...</>
                : <><FileText size={14} /> 擷取 YouTube 字幕 → 自定義匯入</>
              }
            </Button>
          )}

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-primary/40 text-primary font-bold gap-2 hover:bg-primary/5 active:scale-[0.99] transition-all">
                <PlusCircle size={18} /> 自定義匯入 (手動貼上 / 檔案)
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] max-w-lg shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter uppercase text-center">自定義匯入</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground font-medium">貼上日文原文 / SRT 字幕或上傳檔案</p>
                  <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".srt,.txt" className="hidden" />
                    <Button variant="secondary" size="sm" className="h-7 rounded-lg text-[10px] font-black gap-1.5" onClick={() => fileInputRef.current?.click()}>
                      <FileUp size={12} /> 從檔案載入
                    </Button>
                  </div>
                </div>
                <Textarea 
                  placeholder="請在此貼上日文歌詞或對話內容...
(支援純文字或 .srt 格式)" 
                  className="min-h-[250px] rounded-2xl text-base font-medium p-6 bg-muted/20 border-none resize-none focus-visible:ring-primary/20 custom-scrollbar"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
              </div>
              <DialogFooter className="sm:justify-center">
                <Button 
                  className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-primary hover:bg-primary/90"
                  disabled={!manualText.trim() || isImporting}
                  onClick={handleManualSubmit}
                >
                  {isImporting ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2 fill-current" />}
                  確認匯入並分析
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {historyItems.length > 0 && (
        <section className="space-y-4 pb-8">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">歷史紀錄</h2>
          </div>

          <div className="space-y-3">
            {historyItems.map((item) => (
              <div key={item.id} className="group relative">
                <Link 
                  href={`/learn?v=${item.videoId}`}
                  className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-card border border-border/50 hover:border-primary/20 hover:bg-white active:scale-[0.99] transition-all shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                    <PlayCircle size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs truncate text-foreground">{item.songTitle}</h4>
                    <p className="text-[9px] text-indigo-600 font-bold truncate mb-0.5">{item.artistName}</p>
                    <div className="flex items-center gap-3 text-[9px] font-bold text-muted-foreground/60">
                      <span className="flex items-center gap-1 uppercase tracking-tighter"><FileText size={10} /> {item.segmentCount} Segments</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatTime(item.duration)}</span>
                    </div>
                  </div>
                </Link>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    removeByVideoId(item.videoId);
                  }}
                  className="absolute -top-1 -right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-10"
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Legal footer — required for Google OAuth consent screen verification */}
      <div className="mt-8 pb-6 text-center flex items-center justify-center gap-4">
        <Link href="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
          隱私權政策
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <Link href="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
          服務條款
        </Link>
      </div>
    </div>
  );
}
