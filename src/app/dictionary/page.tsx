
"use client"

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDictionaryStore } from "@/store/use-app-store";
import { VocabularyData } from "@/lib/constants/data";
import {
  Book,
  Search,
  Music,
  CheckCircle2,
  Circle,
  ChevronRight,
  PlayCircle,
  X,
  RotateCcw,
  Star,
  Library,
  Trash2,
  Eye,
  EyeOff,
  Volume2,
  Download,
  Upload,
  Check
} from "lucide-react";
import { speak } from "@/lib/speech";
import type { DictEntry } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type DictFilter = "全部" | "學習中" | "已熟練";

export default function DictionaryPage() {
  const {
    entries, removeEntry, toggleMastered, addEntry,
    hiddenPresets, togglePresetHidden, restoreAllPresets,
  } = useDictionaryStore();
  const [filter, setFilter] = useState<DictFilter>("全部");
  const [searchText, setSearchText] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unmasteredCount = entries.filter(e => !e.mastered).length;
  const masteredCount = entries.filter(e => e.mastered).length;

  const filteredEntries = useMemo(() => {
    let list = [...entries];
    if (filter === "學習中") list = list.filter(e => !e.mastered);
    if (filter === "已熟練") list = list.filter(e => e.mastered);
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(e => e.word.toLowerCase().includes(q) || e.reading.toLowerCase().includes(q) || e.romaji.toLowerCase().includes(q) || e.sources.some(s => s.translation.toLowerCase().includes(q)));
    }
    return list;
  }, [entries, filter, searchText]);

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  // ── 批次選取 ──────────────────────────────────────────────────────────────
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredEntries.map(e => e.id)));
  };
  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定刪除 ${selectedIds.size} 個單字嗎？此動作無法復原。`)) return;
    selectedIds.forEach(id => removeEntry(id));
    clearSelection();
  };

  // ── 匯出 / 匯入 ─────────────────────────────────────────────────────────
  const exportDictionary = () => {
    const payload = {
      version:   1,
      exportedAt: new Date().toISOString(),
      count:     entries.length,
      entries,
      hiddenPresets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `nihongo-dictionary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDictionary = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming: DictEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      if (incoming.length === 0) throw new Error('檔案中沒有可匯入的字典條目');
      incoming.forEach(e => {
        if (!e?.word || !e?.reading || !Array.isArray(e?.sources)) return;
        e.sources.forEach(s => {
          if (s?.videoId && s?.songTitle && s?.sentence && s?.translation) {
            // addEntry 會根據 word+reading 去重，重複的 source 也會被略過
            addEntry(e.word, e.reading, s.videoId, s.songTitle, s.sentence, s.translation);
          }
        });
      });
      alert(`匯入完成！處理 ${incoming.length} 筆，已合併到字典（重複條目會自動去重）。`);
    } catch (err: any) {
      setImportError(err?.message || '檔案格式無效');
    }
  };

  return (
    <div className="space-y-6 px-6 py-6">
      {selectionMode ? (
        <header className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-background py-2">
          <Button variant="ghost" size="sm" onClick={clearSelection} className="rounded-full">
            <X size={16} className="mr-1" /> 取消
          </Button>
          <span className="text-sm font-bold text-primary">已選 {selectedIds.size} 個</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={selectAllVisible} className="rounded-full text-xs h-8">全選</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={deleteSelected}
              className="rounded-full text-xs h-8 gap-1"
            >
              <Trash2 size={12} /> 刪除
            </Button>
          </div>
        </header>
      ) : (
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-headline font-bold text-primary">我的字典</h1>
          <div className="flex items-center gap-1.5">
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectionMode(true)}
                className="rounded-full h-9 w-9"
                aria-label="批次選取"
              >
                <Check size={14} />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={exportDictionary}
              disabled={entries.length === 0}
              className="rounded-full h-9 w-9"
              aria-label="匯出字典"
            >
              <Download size={14} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full h-9 w-9"
              aria-label="匯入字典"
            >
              <Upload size={14} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (f) await importDictionary(f);
                e.target.value = '';
              }}
            />
            <Button variant="outline" size="sm" onClick={() => setShowPresetManager(true)} className="rounded-full gap-1.5 h-9">
              <Library size={14} /> 預設
            </Button>
            {unmasteredCount > 0 && (
              <Button onClick={() => setShowReview(true)} className="rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-md gap-2 h-9">
                <RotateCcw size={16} /> 複習
              </Button>
            )}
          </div>
        </header>
      )}
      {importError && (
        <div className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium flex items-center justify-between">
          <span>匯入失敗：{importError}</span>
          <button onClick={() => setImportError(null)}><X size={14} /></button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <StatBadge label="收藏" count={entries.length} color="text-indigo-600" bgColor="bg-indigo-50" />
        <StatBadge label="學習中" count={unmasteredCount} color="text-orange-600" bgColor="bg-orange-50" />
        <StatBadge label="已熟練" count={masteredCount} color="text-green-600" bgColor="bg-green-50" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">{(["全部", "學習中", "已熟練"] as DictFilter[]).map((f) => (<Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="rounded-full h-8 px-4 text-xs font-bold shrink-0" onClick={() => setFilter(f)}>{f}</Button>))}</div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input placeholder="搜尋漢字、假名、拼音..." className="pl-9 h-10 rounded-xl bg-card border-none shadow-sm" value={searchText} onChange={(e) => setSearchText(e.target.value)} /></div>
      </div>
      {filteredEntries.length > 0 ? (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isSelected = selectedIds.has(entry.id);
            return (
              <div
                key={entry.id}
                onClick={() => selectionMode ? toggleSelected(entry.id) : setSelectedEntryId(entry.id)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl bg-card border transition-all cursor-pointer group shadow-sm",
                  selectionMode && isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary",
                )}
              >
                {selectionMode && (
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                  )}>
                    {isSelected && <Check size={14} />}
                  </div>
                )}
                <div className="flex flex-col items-center justify-center min-w-[60px] text-center"><span className="text-[10px] text-indigo-600 font-bold leading-none mb-1">{entry.reading}</span><span className="text-xl font-bold text-foreground leading-none">{entry.word}</span></div>
                <div className="flex-1 min-w-0"><p className="text-[10px] text-orange-500 font-bold mb-1 uppercase tracking-tighter">{entry.romaji}</p><div className="flex items-center gap-1.5 text-muted-foreground"><Music size={10} className="shrink-0" /><span className="text-[10px] font-medium truncate">{entry.sources[0]?.songTitle || "影片課程"}{entry.sources.length > 1 && ` 等 ${entry.sources.length} 處`}</span></div></div>
                {!selectionMode && (
                  <div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); toggleMastered(entry.id); }} className={cn("p-2 rounded-full transition-colors", entry.mastered ? "text-green-500 bg-green-50" : "text-muted-foreground bg-muted/50")}>{entry.mastered ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button><ChevronRight size={16} className="text-muted-foreground" /></div>
                )}
              </div>
            );
          })}
        </div>
      ) : (<div className="flex flex-col items-center justify-center py-20 text-center space-y-4"><Book size={48} className="text-muted-foreground opacity-50" /><div className="space-y-1"><p className="font-bold text-muted-foreground">還沒有收藏的單字</p><p className="text-xs text-muted-foreground/60 px-8">在影片學習中點擊「＋」即可將單字加入字典。</p></div></div>)}
      <Dialog open={!!selectedEntryId} onOpenChange={(open) => !open && setSelectedEntryId(null)}>
        <DialogContent className="rounded-3xl max-w-sm">{selectedEntry && (<div className="space-y-6 py-4"><div className="text-center space-y-2 p-6 bg-indigo-50 rounded-2xl relative"><button onClick={() => speak(selectedEntry.reading || selectedEntry.word)} aria-label="朗讀" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-indigo-600 flex items-center justify-center shadow-sm active:scale-95 transition-all"><Volume2 size={16} /></button><h2 className="text-5xl font-bold text-primary">{selectedEntry.word}</h2><div className="flex items-center justify-center gap-4 text-lg"><span className="text-indigo-600 font-medium">{selectedEntry.reading}</span><span className="text-orange-500 font-medium">{selectedEntry.romaji}</span></div></div><div className="space-y-4"><h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><PlayCircle size={14} /> 出處歌曲 ({selectedEntry.sources.length} 首)</h3><div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">{Object.values(selectedEntry.sources.reduce((acc, src) => { if (!acc[src.videoId]) acc[src.videoId] = { title: src.songTitle, pairs: [] }; acc[src.videoId].pairs.push({ jp: src.sentence, zh: src.translation }); return acc; }, {} as Record<string, { title: string, pairs: { jp: string, zh: string }[] }>)).map((group, idx) => (<div key={idx} className="p-3 bg-muted/30 rounded-xl space-y-2 border border-border/50"><p className="text-[10px] font-bold text-indigo-600 truncate">{group.title}</p>{group.pairs.map((p, pIdx) => (<div key={pIdx} className="space-y-0.5"><p className="text-xs font-medium">{p.jp}</p><p className="text-[10px] text-muted-foreground italic">{p.zh}</p></div>))}</div>))}</div></div><Button variant="destructive" size="sm" className="w-full rounded-xl" onClick={() => { removeEntry(selectedEntry.id); setSelectedEntryId(null); }}>從字典中刪除</Button></div>)}</DialogContent>
      </Dialog>
      <ReviewDialog open={showReview} onOpenChange={setShowReview} list={entries.filter(e => !e.mastered)} />
      <PresetManagerDialog
        open={showPresetManager}
        onOpenChange={setShowPresetManager}
        hiddenPresets={hiddenPresets}
        toggleHidden={togglePresetHidden}
        restoreAll={restoreAllPresets}
      />
    </div>
  );
}

function PresetManagerDialog({
  open, onOpenChange, hiddenPresets, toggleHidden, restoreAll,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hiddenPresets: string[];
  toggleHidden: (word: string) => void;
  restoreAll: () => void;
}) {
  const [searchQ, setSearchQ] = useState("");
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);

  const grouped = useMemo(() => {
    const filtered = VocabularyData.words.filter(w => {
      if (showHiddenOnly && !hiddenPresets.includes(w.word)) return false;
      if (!searchQ) return true;
      const q = searchQ.toLowerCase();
      return w.word.toLowerCase().includes(q)
          || w.furigana.toLowerCase().includes(q)
          || w.translation.toLowerCase().includes(q);
    });
    const out: Record<string, typeof VocabularyData.words> = {};
    filtered.forEach(w => { (out[w.category] ??= []).push(w); });
    return out;
  }, [searchQ, showHiddenOnly, hiddenPresets]);

  const visibleCount = VocabularyData.words.length - hiddenPresets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <Library size={20} /> 預設詞庫管理
            </h2>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-8 w-8">
              <X size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            隱藏的單字不會出現在練習與測驗。目前 {visibleCount} 個可用 / 已隱藏 {hiddenPresets.length} 個。
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="搜尋單字、假名、翻譯..."
              className="pl-9 h-9 rounded-xl text-sm"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant={showHiddenOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHiddenOnly(v => !v)}
              className="rounded-full text-xs h-7 gap-1.5"
            >
              {showHiddenOnly ? <EyeOff size={12} /> : <Eye size={12} />}
              {showHiddenOnly ? "只看已隱藏" : "顯示全部"}
            </Button>
            {hiddenPresets.length > 0 && (
              <Button variant="ghost" size="sm" onClick={restoreAll} className="text-xs h-7 text-orange-600 hover:text-orange-700">
                <RotateCcw size={12} className="mr-1" /> 還原全部
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {Object.entries(grouped).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">沒有符合的單字</p>
          ) : (
            Object.entries(grouped).map(([cat, words]) => (
              <div key={cat} className="space-y-2">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest sticky top-0 bg-background py-1">
                  {cat}
                </h3>
                <div className="space-y-1.5">
                  {words.map(w => {
                    const hidden = hiddenPresets.includes(w.word);
                    return (
                      <div
                        key={w.word}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                          hidden ? "bg-muted/30 border-border opacity-50" : "bg-card border-border/60",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold">{w.word}</span>
                            <span className="text-[11px] text-indigo-600 font-medium">{w.furigana}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{w.translation}</p>
                        </div>
                        <button
                          onClick={() => toggleHidden(w.word)}
                          className={cn(
                            "p-2 rounded-full transition-colors shrink-0",
                            hidden
                              ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20",
                          )}
                          aria-label={hidden ? "還原" : "隱藏"}
                        >
                          {hidden ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBadge({ label, count, color, bgColor }: { label: string, count: number, color: string, bgColor: string }) {
  return (<div className={cn("flex flex-col items-center justify-center p-3 rounded-2xl text-center", bgColor)}><span className={cn("text-xl font-bold", color)}>{count}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span></div>);
}

function ReviewDialog({ open, onOpenChange, list }: { open: boolean, onOpenChange: (o: boolean) => void, list: any[] }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const { toggleMastered } = useDictionaryStore();
  const reset = () => { setIdx(0); setFlipped(false); setCorrect(0); setDone(false); };
  const handleMark = (isCorrect: boolean) => {
    if (isCorrect) { setCorrect(c => c + 1); toggleMastered(list[idx].id); }
    if (idx + 1 < list.length) { setIdx(idx + 1); setFlipped(false); } else { setDone(true); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
      <header className="flex items-center justify-between mb-8"><Button variant="ghost" size="icon" onClick={() => { onOpenChange(false); reset(); }} className="rounded-full"><X /></Button><span className="font-bold text-primary">複習單字</span><div className="w-10" /></header>
      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8"><div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center"><Star size={48} fill="currentColor" /></div><div className="space-y-2"><h2 className="text-3xl font-bold">複習完成！</h2><p className="text-muted-foreground font-medium">您今天掌握了 {correct} 個單字</p></div><div className="grid grid-cols-2 gap-4 w-full max-w-xs"><div className="p-4 bg-green-50 rounded-2xl"><p className="text-2xl font-bold text-green-600">{correct}</p><p className="text-xs text-green-700 font-bold">記住了</p></div><div className="p-4 bg-orange-50 rounded-2xl"><p className="text-2xl font-bold text-orange-600">{list.length - correct}</p><p className="text-xs text-orange-700 font-bold">需加強</p></div></div><Button className="w-full max-w-xs rounded-2xl h-14 text-lg font-bold" onClick={() => { onOpenChange(false); reset(); }}>返回字典</Button></div>
      ) : list.length > 0 ? (
        <div className="flex-1 flex flex-col space-y-8"><div className="space-y-2"><div className="flex justify-between text-xs font-bold text-muted-foreground uppercase"><span>進度 {idx + 1} / {list.length}</span><span className="text-green-600">正確: {correct}</span></div><Progress value={((idx + 1) / list.length) * 100} className="h-2" /></div><div className="flex-1 flex flex-col justify-center"><div className={cn("w-full aspect-square rounded-3xl border-2 flex flex-col items-center justify-center p-8 text-center transition-all duration-500", flipped ? "bg-card border-indigo-200" : "bg-indigo-600 border-indigo-600 shadow-xl")}>{!flipped ? (<div className="space-y-4"><h3 className="text-6xl font-bold text-white">{list[idx].word}</h3><p className="text-indigo-100 font-medium">這個字怎麼唸？</p></div>) : (<div className="space-y-6 animate-in fade-in zoom-in-95"><h3 className="text-5xl font-bold text-primary">{list[idx].word}</h3><div className="space-y-1"><p className="text-2xl font-bold text-indigo-600">{list[idx].reading}</p><p className="text-lg font-bold text-orange-500 uppercase">{list[idx].romaji}</p></div><div className="w-full h-px bg-border my-4" />{list[idx].sources[0] && (<div className="space-y-2"><p className="text-sm font-medium">{list[idx].sources[0].sentence}</p><p className="text-xs text-muted-foreground italic">{list[idx].sources[0].translation}</p></div>)}</div>)}</div></div><div className="pb-8">{!flipped ? (<Button className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg bg-indigo-600 hover:bg-indigo-700" onClick={() => setFlipped(true)}>翻牌看答案</Button>) : (<div className="grid grid-cols-2 gap-4"><Button variant="outline" className="h-16 rounded-2xl text-lg font-bold border-2 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => handleMark(false)}>還不會</Button><Button className="h-16 rounded-2xl text-lg font-bold bg-green-600 hover:bg-green-700 shadow-md" onClick={() => handleMark(true)}>記住了</Button></div>)}</div></div>
      ) : (<div className="flex-1 flex flex-col items-center justify-center text-center"><p className="text-muted-foreground font-medium">沒有需要複習的單字</p></div>)}
    </div>
  );
}
