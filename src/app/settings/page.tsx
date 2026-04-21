
"use client"

import { useState, useEffect } from "react";
import { 
  useSettingsStore, 
  useHistoryStore, 
  useDictionaryStore, 
} from "@/store/use-app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Moon, 
  Sun, 
  Monitor, 
  Type, 
  Globe, 
  Download, 
  Trash2, 
  Key,
  BrainCircuit,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Rocket,
  Info,
  Activity,
  HelpCircle,
  GitBranch,
  CheckCircle2,
  Circle,
  Mic,
  Upload,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// API Rate Limit Data（免費 tier）
const GEMINI_LIMITS: Record<string, { rpm: string, tpm: string, rpd: string }> = {
  "googleai/gemini-2.5-flash":      { rpm: "15", tpm: "1M",  rpd: "500"   },
  "googleai/gemini-2.5-flash-lite": { rpm: "30", tpm: "1M",  rpd: "1,500" },
  "googleai/gemini-2.5-pro":        { rpm: "5",  tpm: "1M",  rpd: "25"    },
  "googleai/gemini-2.0-flash":      { rpm: "15", tpm: "1M",  rpd: "1,500" },
  "googleai/gemini-2.0-flash-lite": { rpm: "30", tpm: "1M",  rpd: "1,500" },
};

const GROQ_LIMITS: Record<string, { rpm: string, tpm: string, rpd: string, tpd: string }> = {
  "openai/llama-3.3-70b-versatile":            { rpm: "30", tpm: "6K", rpd: "14,400", tpd: "100K" },
  "moonshotai/kimi-k2-instruct":               { rpm: "30", tpm: "6K", rpd: "14,400", tpd: "100K" },
  "meta-llama/llama-4-scout-17b-16e-instruct": { rpm: "30", tpm: "6K", rpd: "14,400", tpd: "100K" },
  "openai/llama-3.1-8b-instant":               { rpm: "30", tpm: "6K", rpd: "14,400", tpd: "500K" },
};

export default function SettingsPage() {
  const settings = useSettingsStore();
  const historyStore = useHistoryStore();
  const dictStore = useDictionaryStore();
  const [isMounted, setIsMounted] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showCloudRunKey, setShowCloudRunKey] = useState(false);

  // ── 手動上傳字幕狀態 ─────────────────────────────────────────────────────
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadSrt, setUploadSrt] = useState('');
  const [uploadStatus, setUploadStatus] = useState<
    { state: 'idle' } |
    { state: 'loading' } |
    { state: 'success'; videoId: string; count: number } |
    { state: 'error'; message: string }
  >({ state: 'idle' });

  const handleSrtFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus({ state: 'error', message: '檔案過大（上限 5MB），請確認是 SRT 格式' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadSrt(String(reader.result ?? ''));
    reader.readAsText(file, 'utf-8');
  };

  const handleUpload = async () => {
    setUploadStatus({ state: 'loading' });
    try {
      const res = await fetch('/api/upload-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: uploadUrl, srtContent: uploadSrt }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUploadStatus({ state: 'success', videoId: data.videoId, count: data.segmentCount });
        setUploadUrl('');
        setUploadSrt('');
      } else {
        setUploadStatus({ state: 'error', message: data.error ?? '上傳失敗' });
      }
    } catch (e: any) {
      setUploadStatus({ state: 'error', message: e?.message ?? '網路錯誤' });
    }
  };

  useEffect(() => {
    setIsMounted(true);
    // 遷移：自動修正已下架的 Groq 模型
    const deprecated = ['openai/mixtral-8x7b-32768'];
    if (deprecated.includes(settings.groqModel)) {
      settings.setGroqModel('openai/llama-3.3-70b-versatile');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!isMounted) return null;

  const currentGeminiLimit = GEMINI_LIMITS[settings.geminiModel] || GEMINI_LIMITS["googleai/gemini-2.5-flash"];
  const currentGroqLimit = GROQ_LIMITS[settings.groqModel] ?? GROQ_LIMITS["openai/llama-3.3-70b-versatile"];

  const exportDictionary = () => {
    if (dictStore.entries.length === 0) return;
    const headers = "漢字\t假名\t羅馬拼音\t出處\t熟練度";
    const rows = dictStore.entries.map(e => `${e.word}\t${e.reading}\t${e.romaji}\t${e.sources.map(s => s.songTitle).join("、")}\t${e.mastered ? "已熟練" : "學習中"}`);
    const blob = new Blob([[headers, ...rows].join("\n")], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `NihongoPath_Dictionary.txt`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 px-6 py-6 pb-24">
      <header><h1 className="text-3xl font-headline font-bold text-primary">設定</h1><p className="text-muted-foreground text-sm font-medium">個人化您的學習體驗</p></header>
      
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI 供應商設定</h2>
          </div>

          <Tabs value={settings.aiProvider} onValueChange={(val: any) => settings.setAiProvider(val)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12 mb-4 bg-muted/50 p-1">
              <TabsTrigger value="google" className="rounded-xl font-bold gap-2">
                <Zap size={14} className={settings.aiProvider === 'google' ? 'text-primary' : ''} /> Google Gemini
              </TabsTrigger>
              <TabsTrigger value="groq" className="rounded-xl font-bold gap-2">
                <Rocket size={14} className={settings.aiProvider === 'groq' ? 'text-primary' : ''} /> Groq (極速)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google" className="space-y-4 animate-in fade-in duration-300">
              <Card className="rounded-2xl border-2 border-primary/10 shadow-sm overflow-hidden bg-card">
                <CardContent className="p-0 divide-y">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                          <Key size={20} />
                        </div>
                        <div>
                          <Label className="text-sm font-bold">Gemini API Key</Label>
                          <p className="text-[9px] text-muted-foreground">用於分析影片與深度解說</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowGeminiKey(!showGeminiKey)}>
                        {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                    <Input 
                      type={showGeminiKey ? "text" : "password"}
                      placeholder="貼上 Gemini API Key..."
                      className="rounded-xl bg-muted/30 border-none text-xs h-11 font-mono"
                      value={settings.geminiApiKey}
                      onChange={(e) => settings.setGeminiApiKey(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline">
                        獲取免費金鑰 <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                          <BrainCircuit size={20} />
                        </div>
                        <Label className="text-sm font-bold">預設模型</Label>
                      </div>
                      <Select value={settings.geminiModel} onValueChange={(val) => settings.setGeminiModel(val)}>
                        <SelectTrigger className="w-44 h-10 rounded-xl border-none bg-muted/50 text-[10px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="googleai/gemini-2.5-flash">Gemini 2.5 Flash (建議)</SelectItem>
                          <SelectItem value="googleai/gemini-2.5-pro">Gemini 2.5 Pro (深度)</SelectItem>
                          <SelectItem value="googleai/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (預覽)</SelectItem>
                          <SelectItem value="googleai/gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                          <SelectItem value="googleai/gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (省配額)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">模型配額限制說明</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-blue-900">{currentGeminiLimit.rpm}</p>
                          <p className="text-[8px] text-blue-600 uppercase font-black">RPM (每分鐘請求)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-blue-900">{currentGeminiLimit.tpm}</p>
                          <p className="text-[8px] text-blue-600 uppercase font-black">TPM (每分鐘 Token)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-blue-900">{currentGeminiLimit.rpd}</p>
                          <p className="text-[8px] text-blue-600 uppercase font-black">RPD (每日請求)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Whisper 語音聽寫輔助（Gemini 使用者選填） */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                          <Mic size={20} />
                        </div>
                        <div>
                          <Label className="text-sm font-bold">Whisper 語音聽寫輔助</Label>
                          <p className="text-[9px] text-muted-foreground">選填 Groq Key — 無字幕時自動語音轉錄，與 Gemini 獨立運作</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowGroqKey(!showGroqKey)}>
                        {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                    <Input
                      type={showGroqKey ? "text" : "password"}
                      placeholder="gsk_...（選填）"
                      className="rounded-xl bg-muted/30 border-none text-xs h-11 font-mono"
                      value={settings.groqApiKey}
                      onChange={(e) => settings.setGroqApiKey(e.target.value)}
                    />
                    {settings.groqApiKey ? (
                      <p className="text-[9px] text-violet-600 font-black flex items-center gap-1">
                        <CheckCircle2 size={10} /> Whisper 已就緒（字幕全部失敗時自動啟用）
                      </p>
                    ) : (
                      <div className="flex justify-end">
                        <a href="https://console.groq.com/keys" target="_blank" className="text-[9px] font-bold text-violet-600 flex items-center gap-1 hover:underline">
                          獲取免費 Groq Key <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groq" className="space-y-4 animate-in fade-in duration-300">
              <Card className="rounded-2xl border-2 border-primary/10 shadow-sm overflow-hidden bg-card">
                <CardContent className="p-0 divide-y">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                          <Key size={20} />
                        </div>
                        <div>
                          <Label className="text-sm font-bold">Groq API Key</Label>
                          <p className="text-[9px] text-muted-foreground">極速 Llama 3 系列推理</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowGroqKey(!showGroqKey)}>
                        {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                    <Input 
                      type={showGroqKey ? "text" : "password"}
                      placeholder="貼上 Groq API Key (gsk_...)"
                      className="rounded-xl bg-muted/30 border-none text-xs h-11 font-mono"
                      value={settings.groqApiKey}
                      onChange={(e) => settings.setGroqApiKey(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <a href="https://console.groq.com/keys" target="_blank" className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline">
                        獲取 Groq 金鑰 <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                          <Rocket size={20} />
                        </div>
                        <Label className="text-sm font-bold">Groq 模型</Label>
                      </div>
                      <Select value={settings.groqModel} onValueChange={(val) => settings.setGroqModel(val)}>
                        <SelectTrigger className="w-44 h-10 rounded-xl border-none bg-muted/50 text-[10px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="openai/llama-3.3-70b-versatile">Llama 3.3 70B (建議)</SelectItem>
                          <SelectItem value="moonshotai/kimi-k2-instruct">Kimi K2 (日文優化)</SelectItem>
                          <SelectItem value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</SelectItem>
                          <SelectItem value="openai/llama-3.1-8b-instant">Llama 3.1 8B (極速)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-orange-600" />
                        <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider">模型配額限制說明</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-orange-900">{currentGroqLimit.rpm}</p>
                          <p className="text-[7px] text-orange-600 uppercase font-black">RPM</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-orange-900">{currentGroqLimit.tpm}</p>
                          <p className="text-[7px] text-orange-600 uppercase font-black">TPM</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-orange-900">{currentGroqLimit.rpd}</p>
                          <p className="text-[7px] text-orange-600 uppercase font-black">RPD</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-orange-900">{currentGroqLimit.tpd}</p>
                          <p className="text-[7px] text-orange-600 uppercase font-black">TPD</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 字幕取得管線說明 */}
          <Card className="rounded-2xl border bg-muted/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">字幕取得管線（自動依序嘗試）</h3>
              </div>
              <div className="space-y-2">
                {[
                  { step: "1", label: "YouTube 官方／自動字幕", desc: "時間軸 100% 精準，免 AI 成本，速度最快", color: "text-green-600", bg: "bg-green-500/10" },
                  { step: "2", label: "Cloud Run 語音服務（yt-dlp + Groq）", desc: "需設定 SUBTITLE_SERVICE_URL 環境變數。以 yt-dlp 下載音頻並呼叫 Groq Whisper 轉錄，可繞過 IP 封鎖", color: "text-blue-600", bg: "bg-blue-500/10" },
                  { step: "3", label: "Groq Whisper 語音聽寫", desc: "需設定 Groq API Key。直接由 Next.js 伺服器取得音頻並呼叫 Groq API 轉錄（不經 Cloud Run）", color: "text-violet-600", bg: "bg-violet-500/10" },
                  { step: "4", label: "LrcLib 同步歌詞庫", desc: "常見日文歌曲皆有收錄，速度快；MV 前奏偏移可手動調整", color: "text-teal-600", bg: "bg-teal-500/10" },
                  { step: "5", label: "AI 完整生成（最後手段）", desc: "Gemini / Groq 由 AI 推算歌詞與時間軸，最慢且時間軸可能有誤差", color: "text-orange-600", bg: "bg-orange-500/10" },
                ].map(({ step, label, desc, color, bg }) => (
                  <div key={step} className={`flex items-start gap-3 p-3 rounded-xl ${bg}`}>
                    <span className={`text-[10px] font-black w-5 h-5 rounded-full bg-background flex items-center justify-center shrink-0 mt-0.5 ${color}`}>{step}</span>
                    <div>
                      <p className={`text-[11px] font-bold ${color}`}>{label}</p>
                      <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                分析完成後可由歌詞頁頂部的來源標籤（如「人工字幕」「Whisper 聽寫」）確認實際走了哪條路線。
              </p>
            </CardContent>
          </Card>

          {/* Cloud Run 轉錄服務 — 使用者自備資源 */}
          <Card className="rounded-2xl border bg-muted/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Rocket size={16} className="text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Cloud Run 轉錄服務（自備資源）</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                提供您自己的 Groq API Key 或 YouTube cookies，可避免佔用服務端配額，並繞過地區／年齡限制。
                填入後僅儲存於本機，不上傳至伺服器日誌。
              </p>

              {/* Cloud Run 專用 Groq Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                      <Key size={16} />
                    </div>
                    <div>
                      <Label className="text-sm font-bold">Groq API Key（轉錄用）</Label>
                      <p className="text-[9px] text-muted-foreground">Cloud Run 用此 key 呼叫 Whisper，不影響 AI 標注配額</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCloudRunKey(!showCloudRunKey)}>
                    {showCloudRunKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
                <Input
                  type={showCloudRunKey ? 'text' : 'password'}
                  placeholder="gsk_...（選填，留空則使用服務端內建 key）"
                  className="rounded-xl bg-muted/30 border-none text-xs h-11 font-mono"
                  value={settings.cloudRunGroqApiKey}
                  onChange={(e) => settings.setCloudRunGroqApiKey(e.target.value)}
                />
                {settings.cloudRunGroqApiKey && (
                  <p className="text-[9px] text-orange-600 font-black flex items-center gap-1">
                    <CheckCircle2 size={10} /> 轉錄將計入您的 Groq 帳號配額
                  </p>
                )}
              </div>

              {/* Cookie 上傳 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <FileText size={16} />
                    </div>
                    <div>
                      <Label className="text-sm font-bold">YouTube cookies.txt</Label>
                      <p className="text-[9px] text-muted-foreground">Netscape 格式，可繞過年齡／地區限制</p>
                    </div>
                  </div>
                  <label className="text-[10px] font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline">
                    <Upload size={11} />
                    選擇檔案
                    <input
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 100 * 1024) {
                          alert('cookies.txt 過大（上限 100KB）');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const text = String(reader.result ?? '');
                          if (!text.trimStart().startsWith('# Netscape')) {
                            alert('必須是 Netscape HTTP Cookie File 格式（第一行應為 # Netscape HTTP Cookie File）');
                            return;
                          }
                          settings.setCloudRunCookieContent(text);
                        };
                        reader.readAsText(f, 'utf-8');
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <Textarea
                  placeholder={"# Netscape HTTP Cookie File\n# 從瀏覽器 Cookie 匯出工具取得，貼上或選擇檔案"}
                  value={settings.cloudRunCookieContent}
                  onChange={(e) => settings.setCloudRunCookieContent(e.target.value)}
                  className="rounded-xl bg-muted/30 border-none text-[10px] font-mono min-h-[80px] resize-y"
                />
                {settings.cloudRunCookieContent ? (
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-blue-600 font-black flex items-center gap-1">
                      <CheckCircle2 size={10} /> cookies 已設定（{(settings.cloudRunCookieContent.length / 1024).toFixed(1)} KB）
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-[9px] text-destructive px-2"
                      onClick={() => settings.setCloudRunCookieContent('')}>
                      清除
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* 隱私提醒 */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/60">
                <p className="text-[9px] text-amber-700 leading-relaxed font-medium">
                  ⚠ <span className="font-black">隱私提醒：</span>cookies 僅用於本次轉錄請求，不會被記錄於日誌。
                  建議使用專用的限額 Groq Key，避免提供主帳號 key。
                  請勿在公用電腦設定 cookies。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 手動上傳字幕到 Firestore */}
          <Card className="rounded-2xl border bg-muted/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">手動上傳字幕到 Firestore</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                若自動管線都抓不到字幕，可在此手動提供 YouTube 網址 + SRT 檔案，直接寫入快取（30 天）。
                下次分析同一支影片時會立即命中，跳過所有抓取步驟。
              </p>

              {/* YouTube URL 輸入 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground">YouTube 網址</Label>
                <Input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="rounded-xl bg-background border text-xs h-10 font-mono"
                />
              </div>

              {/* SRT 檔案上傳 + 貼上 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-muted-foreground">SRT 字幕內容</Label>
                  <label className="text-[10px] font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline">
                    <FileText size={11} />
                    選擇檔案
                    <input
                      type="file"
                      accept=".srt,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSrtFile(f);
                      }}
                    />
                  </label>
                </div>
                <Textarea
                  placeholder={"1\n00:00:12,000 --> 00:00:15,500\n歌詞第一行\n\n2\n00:00:15,800 --> 00:00:18,200\n歌詞第二行"}
                  value={uploadSrt}
                  onChange={(e) => setUploadSrt(e.target.value)}
                  className="rounded-xl bg-background border text-[10px] font-mono min-h-[140px] resize-y"
                />
              </div>

              {/* 狀態提示 */}
              {uploadStatus.state === 'success' && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-200 text-[10px] text-green-700 flex items-start gap-2">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">上傳成功</p>
                    <p className="text-green-600 mt-0.5">
                      videoId: <span className="font-mono">{uploadStatus.videoId}</span> — 共 {uploadStatus.count} 段
                    </p>
                  </div>
                </div>
              )}
              {uploadStatus.state === 'error' && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-[10px] text-destructive flex items-start gap-2">
                  <XCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">上傳失敗</p>
                    <p className="opacity-80 mt-0.5">{uploadStatus.message}</p>
                  </div>
                </div>
              )}

              {/* 送出按鈕 */}
              <Button
                onClick={handleUpload}
                disabled={!uploadUrl.trim() || !uploadSrt.trim() || uploadStatus.state === 'loading'}
                className="w-full rounded-xl font-bold gap-2"
              >
                {uploadStatus.state === 'loading' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> 上傳中…
                  </>
                ) : (
                  <>
                    <Upload size={14} /> 寫入 Firestore
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-muted/10">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest">API 限制術語說明</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase">RPM (Requests Per Minute)</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed font-medium">每分鐘請求數。這限制了您在一分鐘內可以呼叫幾次 AI（例如：分析影片或文法解說）。</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase">TPM (Tokens Per Minute)</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed font-medium">每分鐘 Token 數。代表每分鐘能處理的文字總量。分析長歌詞時較容易觸發此上限。</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase">RPD (Requests Per Day)</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed font-medium">每日請求數。這是 24 小時內總分析次數的配額。</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-primary uppercase">TPD (Tokens Per Day)</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed font-medium">每日 Token 數。限制了一天內總共能處理的文字標註與翻譯規模。</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">外觀介面</h2>
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {settings.themeMode === 'light' ? <Sun size={18} /> : settings.themeMode === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
                  </div>
                  <Label className="text-sm font-bold">主題模式</Label>
                </div>
                <Select value={settings.themeMode} onValueChange={(val: any) => settings.setThemeMode(val)}>
                  <SelectTrigger className="w-32 h-9 rounded-xl border-none bg-muted/50 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="system">跟隨系統</SelectItem>
                    <SelectItem value="light">淺色模式</SelectItem>
                    <SelectItem value="dark">深色模式</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                      <Type size={18} />
                    </div>
                    <Label className="text-sm font-bold">歌詞字體大小</Label>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground">{settings.lyricsFontSize} pt</span>
                </div>
                <div className="px-2">
                  <Slider value={[settings.lyricsFontSize]} min={14} max={32} step={1} onValueChange={(val) => settings.setLyricsFontSize(val[0])} />
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
                      <Type size={18} />
                    </div>
                    <div>
                      <Label className="text-sm font-bold">每行最多字元數</Label>
                      <p className="text-[9px] text-muted-foreground">超過此數強制換行；0 = 不限制</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    {settings.maxCharsPerLine === 0 ? '不限' : `${settings.maxCharsPerLine} 字`}
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={[settings.maxCharsPerLine]}
                    min={0} max={50} step={1}
                    onValueChange={(val) => settings.setMaxCharsPerLine(val[0])}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">學習偏好</h2>
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-0 divide-y">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600">
                    <span className="font-bold text-xs">あ</span>
                  </div>
                  <div>
                    <Label className="text-sm font-bold">顯示讀音（平假名）</Label>
                    <p className="text-[9px] text-muted-foreground">漢字上方標注振假名</p>
                  </div>
                </div>
                <Switch checked={settings.showFurigana} onCheckedChange={settings.setShowFurigana} />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <span className="font-black text-[10px]">A</span>
                  </div>
                  <div>
                    <Label className="text-sm font-bold">顯示羅馬拼音</Label>
                    <p className="text-[9px] text-muted-foreground">原文上方以拉丁字母標音</p>
                  </div>
                </div>
                <Switch checked={settings.showRomaji} onCheckedChange={settings.setShowRomaji} />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-600">
                    <span className="font-bold text-xs">カ</span>
                  </div>
                  <div>
                    <Label className="text-sm font-bold">片假名也顯示讀音</Label>
                    <p className="text-[9px] text-muted-foreground">關閉時外來語（純片假名）不標讀音</p>
                  </div>
                </div>
                <Switch checked={settings.showKatakanaReading} onCheckedChange={settings.setShowKatakanaReading} />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Globe size={18} />
                  </div>
                  <Label className="text-sm font-bold">顯示中文翻譯</Label>
                </div>
                <Switch checked={settings.showTranslation} onCheckedChange={settings.setShowTranslation} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">資料管理</h2>
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-0 divide-y">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="text-muted-foreground" size={18} />
                  <span className="text-sm font-medium">匯出字典資料</span>
                </div>
                <Button variant="ghost" size="sm" onClick={exportDictionary} disabled={dictStore.entries.length === 0} className="font-bold text-primary">
                  匯出
                </Button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="w-full p-4 flex items-center gap-3 hover:bg-destructive/10 transition-colors text-destructive"><Key size={18} /><span className="text-sm font-bold">清除所有 API 金鑰</span></button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl max-w-[90vw]">
                  <AlertDialogHeader><AlertDialogTitle>清除 API 金鑰</AlertDialogTitle><AlertDialogDescription>這將從本地存儲中刪除您的 Gemini 和 Groq API 金鑰。</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel><AlertDialogAction onClick={() => settings.resetApiKeys()} className="bg-destructive hover:bg-destructive/90 rounded-xl">確認清除</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="w-full p-4 flex items-center gap-3 hover:bg-destructive/10 transition-colors text-destructive"><Trash2 size={18} /><span className="text-sm font-bold">清除所有歷史紀錄</span></button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl max-w-[90vw]">
                  <AlertDialogHeader><AlertDialogTitle>清除歷史紀錄</AlertDialogTitle><AlertDialogDescription>這將刪除所有已快取的影片解析結果，無法復原。</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel><AlertDialogAction onClick={() => historyStore.clearAll()} className="bg-destructive hover:bg-destructive/90 rounded-xl">確認清除</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
