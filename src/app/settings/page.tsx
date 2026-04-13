
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
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// API Rate Limit Data
const GEMINI_LIMITS: Record<string, { rpm: string, tpm: string, rpd: string }> = {
  "googleai/gemini-1.5-flash": { rpm: "15", tpm: "1M", rpd: "1,500" },
  "googleai/gemini-1.5-pro": { rpm: "2", tpm: "32K", rpd: "50" },
};

const GROQ_LIMITS: Record<string, { rpm: string, tpm: string, rpd: string, tpd: string }> = {
  "openai/llama-3.1-8b-instant": { rpm: "30", tpm: "14.4K", rpd: "6,000", tpd: "500K" },
  "openai/llama-3.3-70b-versatile": { rpm: "30", tpm: "1K", rpd: "12,000", tpd: "100K" },
  "openai/mixtral-8x7b-32768": { rpm: "30", tpm: "5K", rpd: "14,400", tpd: "500K" },
};

export default function SettingsPage() {
  const settings = useSettingsStore();
  const historyStore = useHistoryStore();
  const dictStore = useDictionaryStore();
  const [isMounted, setIsMounted] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  const currentGeminiLimit = GEMINI_LIMITS[settings.geminiModel] || GEMINI_LIMITS["googleai/gemini-1.5-flash"];
  const currentGroqLimit = GROQ_LIMITS[settings.groqModel] || GROQ_LIMITS["openai/llama-3.3-70b-versatile"];

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
                          <SelectItem value="googleai/gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="googleai/gemini-1.5-pro">Gemini 1.5 Pro (深度)</SelectItem>
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
                          <SelectItem value="openai/llama-3.3-70b-versatile">Llama 3.3 70B</SelectItem>
                          <SelectItem value="openai/mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                          <SelectItem value="openai/llama-3.1-8b-instant">Llama 3.1 8B</SelectItem>
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
                  <Label className="text-sm font-bold">預設標注模式</Label>
                </div>
                <Select value={settings.defaultAnnotation} onValueChange={(val: any) => settings.setDefaultAnnotation(val)}>
                  <SelectTrigger className="w-32 h-9 rounded-xl border-none bg-muted/50 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="furigana">僅假名</SelectItem>
                    <SelectItem value="romaji">僅羅馬拼音</SelectItem>
                    <SelectItem value="both">假名 + 拼音</SelectItem>
                    <SelectItem value="none">隱藏標注</SelectItem>
                  </SelectContent>
                </Select>
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
