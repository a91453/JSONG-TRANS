
'use client';

import { useState, useCallback, useRef } from 'react';
import type { AnalyzeResponse } from '@/types';
import { useHistoryStore, useSettingsStore } from '@/store/use-app-store';
import { fetchYouTubeInfo } from '@/lib/youtube';
import { analyzeVideoAction } from '@/ai/flows/analyze-video';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function useAnalyze() {
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState("準備中…");
  const [videoTitle, setVideoTitle] = useState("");
  const [artistName, setArtistName] = useState("");

  const { toast } = useToast();
  const router = useRouter();
  const historyStore = useHistoryStore();
  const settings = useSettingsStore();
  const isLoadingRef = useRef(false);

  const simulateStages = useCallback(async () => {
    const stages = [
      { d: 1.5, t: "正在連線至 AI 引擎 🚀" },
      { d: 2.5, t: "正在解析日文語法與讀音 📝" },
      { d: 1.5, t: "正在翻譯並同步時間軸…" }
    ];

    for (const stage of stages) {
      if (!isLoadingRef.current) break;
      await new Promise(r => setTimeout(r, stage.d * 1000));
      if (isLoadingRef.current) setLoadingStage(stage.t);
    }
  }, []);

  const analyze = useCallback(async (videoId: string) => {
    if (!videoId || (videoId.length !== 11 && !videoId.startsWith('file-') && !videoId.startsWith('custom_'))) return;

    const provider = settings.aiProvider;
    const apiKey = provider === 'google' ? settings.geminiApiKey : settings.groqApiKey;
    const model = provider === 'google' ? settings.geminiModel : settings.groqModel;

    // 檢查是否有 API Key
    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "缺少 API Key",
        description: `請前往「設定」頁面輸入您的 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key 才能開始分析。`
      });
      router.push('/settings');
      return;
    }

    setIsLoading(true);
    isLoadingRef.current = true;
    setErrorMessage(null);
    setResponse(null);
    setLoadingStage("連線中…");

    // 1. Check Cache
    const cachedResult = historyStore.results[videoId];
    if (cachedResult) {
      setResponse({ ...cachedResult, source: 'cache' });
      setIsLoading(false);
      isLoadingRef.current = false;
      const meta = historyStore.items.find(i => i.videoId === videoId);
      if (meta) {
        setVideoTitle(meta.songTitle);
        setArtistName(meta.artistName);
      }
      return;
    }

    try {
      simulateStages();

      const info = await fetchYouTubeInfo(videoId);
      const title = info?.title || "未命名內容";
      const author = info?.author || "YouTube";
      setVideoTitle(title);
      setArtistName(author);

      const finalResponse = await analyzeVideoAction({
        videoId,
        videoTitle: title,
        config: {
          provider,
          apiKey,
          model
        }
      });

      setResponse(finalResponse);
      historyStore.saveResult(finalResponse, title, author);
      
    } catch (error: any) {
      console.error('Error in useAnalyze:', error);
      const msg = error.message || "";
      if (msg.includes("429") || msg.includes("Quota") || msg.includes("limit")) {
        setErrorMessage("API 配額已滿，請稍候 30 秒再試。建議檢查 API Key 狀態。");
      } else {
        setErrorMessage(msg || "分析失敗，請檢查網路或 API 設定。");
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [historyStore, settings, simulateStages, toast, router]);

  return {
    response,
    isLoading,
    errorMessage,
    loadingStage,
    videoTitle,
    artistName,
    analyze
  };
}
