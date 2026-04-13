
"use client"

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HiraganaData, KatakanaData, KanaType } from "@/lib/constants/data";
import { useProgressStore } from "@/store/use-app-store";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/speech";

export default function KanaGridPage() {
  const [charType, setCharType] = useState<"hiragana" | "katakana">("hiragana");
  const [soundType, setSoundType] = useState<KanaType>("seion");
  const { addKana } = useProgressStore();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const filteredKana = useMemo(() => {
    const sourceData = charType === "katakana" ? KatakanaData.all : HiraganaData.all;
    return sourceData.filter(k => k.type === soundType);
  }, [charType, soundType]);
  const playSound = (char: string) => { speak(char); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); addKana(); };
  if (!isMounted) return null;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <header className="sticky top-[64px] z-20 bg-background/80 backdrop-blur-md border-b px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft /></Button></Link>
          <h1 className="text-xl font-headline font-bold text-primary">五十音表</h1>
        </div>
        <div className="space-y-3">
          <Tabs value={charType} onValueChange={(v) => setCharType(v as any)} className="w-full"><TabsList className="grid w-full grid-cols-2 rounded-xl h-10 bg-muted/50 p-1"><TabsTrigger value="hiragana" className="rounded-lg font-bold text-xs">平假名 あ</TabsTrigger><TabsTrigger value="katakana" className="rounded-lg font-bold text-xs">片假名 ア</TabsTrigger></TabsList></Tabs>
          <Tabs value={soundType} onValueChange={(v) => setSoundType(v as any)} className="w-full"><TabsList className="grid w-full grid-cols-3 rounded-xl h-10 bg-muted/50 p-1"><TabsTrigger value="seion" className="rounded-lg font-bold text-xs">清音</TabsTrigger><TabsTrigger value="dakuon" className="rounded-lg font-bold text-xs">濁音/半濁</TabsTrigger><TabsTrigger value="yoon" className="rounded-lg font-bold text-xs">拗音</TabsTrigger></TabsList></Tabs>
        </div>
      </header>
      <main className="flex-1 p-4">
        <div className={cn("grid gap-3 transition-all duration-300", soundType === "yoon" ? "grid-cols-3" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6")}>
          {filteredKana.map((kana, idx) => (
            <button key={`${kana.character}-${idx}`} onClick={() => playSound(kana.character)} className={cn("aspect-square flex flex-col items-center justify-center bg-card rounded-2xl border border-border shadow-sm active:scale-95 active:bg-primary/5 transition-all group hover:border-primary/40 animate-in fade-in zoom-in-95 duration-300")}>
              <span className={cn("text-3xl font-bold transition-colors leading-none text-primary")}>{kana.character}</span>
              <span className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-tighter">{kana.romaji}</span>
            </button>
          ))}
        </div>
        <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3"><Info className="text-primary shrink-0 mt-0.5" size={18} /><p className="text-xs text-muted-foreground leading-relaxed">點擊假名方塊可聽取標準發音。</p></div>
      </main>
    </div>
  );
}
