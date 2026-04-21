'use client';
/**
 * @fileOverview SSE 流式分析 Hook
 *
 * 連接 /api/analyze-stream，以批次方式逐步接收已標注的字幕段落，
 * 讓使用者在第一批（~15 段）標注完成後即可看到字幕，無需等待全部完成。
 *
 * Google Auth 流程：
 *   1. 後端偵測到 YouTube 封鎖 GCP IP → 發送 need_google_auth 事件
 *   2. 客戶端顯示 Google 登入 Modal（needGoogleAuth = true）
 *   3. 使用者登入後 → handleGoogleSignIn(videoId) 取得 token 並重新分析
 *   4. 使用者跳過 → dismissGoogleAuth() 關閉 Modal，改走一般 analyzeVideoAction 路徑
 */

import { useState, useCallback, useRef } from 'react';
import type { AnalyzeResponse, Segment } from '@/types';
import { useHistoryStore, useSettingsStore } from '@/store/use-app-store';
import { fetchYouTubeInfo } from '@/lib/youtube';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useGoogleAuth } from '@/hooks/use-google-auth';

export function useAnalyzeStream() {
  const [streamedSegments, setStreamedSegments] = useState<Segment[]>([]);
  const [response,         setResponse        ] = useState<AnalyzeResponse | null>(null);
  const [isLoading,        setIsLoading       ] = useState(false);
  const [errorMessage,     setErrorMessage    ] = useState<string | null>(null);
  const [loadingStage,     setLoadingStage    ] = useState('準備中…');
  const [videoTitle,       setVideoTitle      ] = useState('');
  const [artistName,       setArtistName      ] = useState('');
  const [needGoogleAuth,   setNeedGoogleAuth  ] = useState(false);

  const { toast }        = useToast();
  const router           = useRouter();
  const historyStore     = useHistoryStore();
  const settings         = useSettingsStore();
  const isLoadingRef       = useRef(false);
  // Ref 版本的 needGoogleAuth，供 useCallback 內的 async 閉包讀取（避免 stale state）
  const needGoogleAuthRef  = useRef(false);
  const { signIn, getValidToken, isSigningIn } = useGoogleAuth();

  // ── 核心分析函式 ────────────────────────────────────────────────────────────

  const analyze = useCallback(async (
    videoId:      string,
    forceRefresh  = false,
    googleToken?: string
  ) => {
    if (!videoId || (
      videoId.length !== 11 &&
      !videoId.startsWith('file-') &&
      !videoId.startsWith('custom_')
    )) return;

    // 防止 setResponse(null) 引發的重複觸發
    if (isLoadingRef.current) return;

    const provider = settings.aiProvider;
    const apiKey   = provider === 'google' ? settings.geminiApiKey : settings.groqApiKey;
    const model    = provider === 'google' ? settings.geminiModel  : settings.groqModel;

    if (!apiKey) {
      toast({
        variant:     'destructive',
        title:       '缺少 API Key',
        description: `請前往「設定」頁面輸入您的 ${provider === 'google' ? 'Gemini' : 'Groq'} API Key 才能開始分析。`,
      });
      router.push('/settings');
      return;
    }

    setIsLoading(true);
    isLoadingRef.current    = true;
    needGoogleAuthRef.current = false;
    setErrorMessage(null);
    setResponse(null);
    setStreamedSegments([]);
    setNeedGoogleAuth(false);
    setLoadingStage('連線中…');

    // ── 快取檢查（forceRefresh 時跳過並清除）──────────────────────────────
    if (!forceRefresh) {
      const cached = historyStore.results[videoId];
      if (cached) {
        setResponse({ ...cached, source: 'cache' });
        setStreamedSegments(cached.segments ?? []);
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
      historyStore.removeByVideoId(videoId);
    }

    try {
      const info   = await fetchYouTubeInfo(videoId);
      const title  = info?.title  || '未命名內容';
      const author = info?.author || 'YouTube';
      setVideoTitle(title);
      setArtistName(author);

      // 優先使用呼叫者傳入的 token，再嘗試 sessionStorage 快取
      const gToken = googleToken ?? getValidToken() ?? undefined;

      // ── SSE 串流 ──────────────────────────────────────────────────────
      const res = await fetch('/api/analyze-stream', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          videoId,
          videoTitle:   title,
          forceRefresh,
          groqApiKeyForWhisper: settings.groqApiKey || undefined,
          googleToken:  gToken,
          config:       { provider, apiKey, model },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '連線失敗' }));
        throw new Error(err.error || '分析失敗');
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      const allSegs: Segment[] = [];
      let finalSource       = 'genkit-ai';
      let finalDuration     = 0;
      let finalExpectedTotal = 0;
      // server-sent error message — thrown after the loop so it escapes inner catch
      let serverError: string | null = null;

      // evt/data must persist across read() boundaries in case an SSE event
      // is split between two chunks (event: line in one, data: in the next)
      let evt  = '';
      let data = '';

      try {
        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              evt  = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.slice(6).trim();
            } else if (line === '' && evt && data) {
              try {
                const payload = JSON.parse(data);

                if (evt === 'stage') {
                  setLoadingStage(payload.text);

                } else if (evt === 'need_google_auth') {
                  needGoogleAuthRef.current = true;
                  setNeedGoogleAuth(true);
                  setIsLoading(false);
                  isLoadingRef.current = false;
                  break outer;

                } else if (evt === 'batch') {
                  const newSegs = payload.segments as Segment[];
                  allSegs.push(...newSegs);
                  // 並行批次可能亂序抵達，依 start 排序後再更新（避免顯示錯亂）
                  setStreamedSegments(prev =>
                    [...prev, ...newSegs].sort((a, b) => a.start - b.start)
                  );

                } else if (evt === 'done') {
                  finalSource        = payload.source;
                  finalDuration      = payload.duration ?? 0;
                  finalExpectedTotal = payload.expectedTotal ?? 0;

                } else if (evt === 'error') {
                  // 儲存伺服器錯誤，迴圈結束後再拋出（避免被 inner catch 吞掉）
                  serverError = payload.message;
                  break outer;
                }
              } catch {
                // JSON 解析失敗：忽略並繼續
              }

              evt  = '';
              data = '';
            }
          }
        }
      } finally {
        // 無論成功/失敗都釋放 reader，避免連線殘留
        reader.cancel().catch(() => {});
      }

      // 伺服器回傳錯誤事件 → 在 inner catch 外拋出，正確顯示給使用者
      if (serverError) throw new Error(serverError);

      // need_google_auth 時提前跳出，不儲存空結果（用 ref 避免 stale closure）
      if (needGoogleAuthRef.current) return;

      // ── 建立最終回應並存入 localStorage ──────────────────────────────
      // 並行完成的批次可能亂序，依 start 排序確保最終資料時間軸正確
      const sortedSegs = [...allSegs].sort((a, b) => a.start - b.start);
      const finalResponse: AnalyzeResponse = {
        videoId,
        duration: finalDuration || sortedSegs[sortedSegs.length - 1]?.end || 0,
        segments: sortedSegs,
        source:   finalSource as any,
      };

      // 完整性檢查：若有預期段落數且實際不足 90%，代表部分批次失敗，不儲存
      const isPartialResult =
        finalExpectedTotal > 0 &&
        sortedSegs.length < finalExpectedTotal * 0.9;

      setResponse(finalResponse);
      if (isPartialResult) {
        toast({
          variant:     'destructive',
          title:       '字幕不完整，未儲存',
          description: `僅成功標注 ${sortedSegs.length}/${finalExpectedTotal} 段（部分批次失敗），結果僅供本次瀏覽，請重試以取得完整字幕。`,
        });
      } else {
        historyStore.saveResult(finalResponse, title, author);
      }

      // ── 來源提示 Toast ─────────────────────────────────────────────────
      if (finalSource === 'whisper-groq') {
        toast({
          title:       'Groq Whisper 語音聽寫',
          description: '未找到現成字幕，已從音頻轉錄，時間軸精準。',
        });
      } else if (finalSource === 'genkit-ai') {
        toast({
          title:       'AI 推算字幕',
          description: '找不到任何字幕來源，時間軸由 AI 推估，可能與影片有偏差。',
          variant:     'destructive',
        });
      } else if (finalSource === 'lrclib') {
        toast({
          title:       'LrcLib 歌詞載入',
          description: '若時間軸與 MV 不同步，請用工具列的 ＋/－ 調整偏移。',
        });
      }

    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('location is not supported') || msg.includes('USER_LOCATION') || msg.includes('INVALID_ARGUMENT')) {
        setErrorMessage('您的 Gemini API Key 所在地區不支援免費版，請至 Google AI Studio 啟用計費後再試，或改用 Groq API Key。');
      } else if (msg.includes('流量過高') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
        setErrorMessage('AI 服務暫時繁忙，請稍候幾秒後點「重試一次」。');
      } else if (msg.includes('429') || msg.includes('Quota') || msg.includes('limit') || msg.includes('RESOURCE_EXHAUSTED')) {
        setErrorMessage('Gemini 免費版每分鐘限 5 次請求，請稍候 30 秒再試。若需更快的速度，請啟用 Google AI Studio 計費或改用 Groq。');
      } else {
        setErrorMessage(msg || '分析失敗，請檢查網路或 API 設定後再試。');
      }
    } finally {
      if (isLoadingRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [historyStore, settings, toast, router, getValidToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Google 登入後重試 ───────────────────────────────────────────────────────

  const handleGoogleSignIn = useCallback(async (videoId: string) => {
    const token = await signIn();
    if (token) {
      setNeedGoogleAuth(false);
      await analyze(videoId, false, token);
    }
  }, [signIn, analyze]);

  /** 關閉 Google 登入 Modal，不重試（讓使用者手動操作或接受 AI 生成） */
  const dismissGoogleAuth = useCallback(() => {
    setNeedGoogleAuth(false);
  }, []);

  return {
    response,
    streamedSegments,
    isLoading,
    isSigningIn,
    errorMessage,
    loadingStage,
    videoTitle,
    artistName,
    needGoogleAuth,
    analyze,
    handleGoogleSignIn,
    dismissGoogleAuth,
  };
}
