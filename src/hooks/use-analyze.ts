
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
      { d: 0.8, t: "正在比對 YouTube 字幕…" },
      { d: 0.8, t: "正在搜尋 LrcLib 歌詞庫…" },
      { d: 1.5, t: "正在進行 Whisper 語音聽寫…" },
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

  /**
   * @param videoId - YouTube / custom / file ID
   * @param forceRefresh - 跳過所有快取，強制重新分析（「重新分析」按鈕使用）
   */
  const analyze = useCallback(async (videoId: string, forceRefresh = false) => {
    if (!videoId || (videoId.length !== 11 && !videoId.startsWith('file-') && !videoId.startsWith('custom_'))) return;
    // 防止重複觸發（setResponse(null) 會引發 useEffect 重新呼叫）
    if (isLoadingRef.current) return;

    const provider = settings.aiProvider;
    const apiKey = provider === 'google' ? settings.geminiApiKey : settings.groqApiKey;
    const model = provider === 'google' ? settings.geminiModel : settings.groqModel;

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

    // ── 快取檢查（forceRefresh 時跳過，並清除舊紀錄）────────────────────
    if (!forceRefresh) {
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
    } else {
      // 刪除 localStorage 快取，確保重新分析
      historyStore.removeByVideoId(videoId);
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
        forceRefresh,
        // 無論主要供應商為何，都傳 Groq Key 供 Whisper 使用
        groqApiKeyForWhisper: settings.groqApiKey || undefined,
        config: { provider, apiKey, model }
      });

      setResponse(finalResponse);
      historyStore.saveResult(finalResponse, title, author);

      // ── 顯示來源提示（讓使用者知道走了哪條管線）──────────────────────
      const src = finalResponse.source;
      if (src === 'whisper-groq') {
        toast({
          title: "Groq Whisper 語音聽寫",
          description: "未找到現成字幕，已從音頻轉錄，時間軸精準。",
        });
      } else if (src === 'genkit-ai') {
        toast({
          title: "AI 推算字幕",
          description: "找不到任何字幕來源，時間軸由 AI 推估，可能與影片有偏差。",
          variant: "destructive",
        });
      } else if (src === 'lrclib') {
        toast({
          title: "LrcLib 歌詞載入",
          description: "若時間軸與 MV 不同步，請用工具列的 ＋/－ 調整偏移。",
        });
      }

    } catch (error: any) {
      console.error('Error in useAnalyze:', error);
      const msg = error.message || "";
      if (msg.includes("流量過高") || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
        setErrorMessage("AI 服務暫時繁忙，請稍候幾秒後點「重試一次」。");
      } else if (msg.includes("429") || msg.includes("Quota") || msg.includes("limit") || msg.includes("RESOURCE_EXHAUSTED")) {
        setErrorMessage("API 配額已滿，請稍候 30 秒再試。建議檢查 API Key 狀態。");
      } else if (msg.includes("Server Components") || msg.includes("digest") || !msg) {
        setErrorMessage("伺服器發生錯誤，請確認 API Key 正確且模型可使用，然後重試。");
      } else {
        setErrorMessage(msg);
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
