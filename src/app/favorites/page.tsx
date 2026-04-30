"use client"

import { useState, useMemo } from "react";
import Link from "next/link";
import { useFavoriteStore, useDictionaryStore, useHistoryStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Music, Clock, ChevronRight, BookOpen, Disc3 } from "lucide-react";
import { formatTime } from "@/lib/utils";

export default function FavoritesPage() {
  const { items, removeFavorite } = useFavoriteStore();
  const { entries }               = useDictionaryStore();
  const { items: historyItems }   = useHistoryStore();

  // ── 統計每首歌貢獻的字典條目 ───────────────────────────────────────
  // key 用 videoId（穩定），同時保留歌名
  const songContributions = useMemo(() => {
    const map = new Map<string, { videoId: string; songTitle: string; entryIds: string[] }>();
    entries.forEach(e => {
      const seen = new Set<string>();
      e.sources.forEach(s => {
        if (!s.videoId || seen.has(s.videoId)) return;
        seen.add(s.videoId);
        const cur = map.get(s.videoId) ?? {
          videoId: s.videoId,
          songTitle: s.songTitle || '未知歌曲',
          entryIds: [],
        };
        cur.entryIds.push(e.id);
        map.set(s.videoId, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.entryIds.length - a.entryIds.length);
  }, [entries]);

  const [openSong, setOpenSong] = useState<string | null>(null);
  const openSongData = openSong ? songContributions.find(s => s.videoId === openSong) : null;
  const openSongEntries = useMemo(
    () => openSongData ? entries.filter(e => openSongData.entryIds.includes(e.id)) : [],
    [openSongData, entries]
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft /></Button></Link>
        <h1 className="text-2xl font-headline font-bold text-primary">收藏</h1>
      </header>

      <Tabs defaultValue="sentences" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12 mb-4 bg-muted/50 p-1">
          <TabsTrigger value="sentences" className="rounded-xl font-bold gap-2">
            <Quote size={14} /> 句子（{items.length}）
          </TabsTrigger>
          <TabsTrigger value="songs" className="rounded-xl font-bold gap-2">
            <Disc3 size={14} /> 歌曲（{songContributions.length}）
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: 句子收藏 ─────────────────────────────────────────── */}
        <TabsContent value="sentences" className="mt-0">
          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map((fav) => (
                <Card key={fav.id} className="overflow-hidden border-none shadow-md group">
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      <Link href={`/learn?v=${fav.videoId}`} className="flex-1 p-4 space-y-3 hover:bg-muted/30 transition-colors">
                        <div className="space-y-1">
                          <p className="text-lg font-bold leading-tight">{fav.japanese}</p>
                          <p className="text-sm text-muted-foreground">{fav.translation}</p>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-indigo-600 font-medium">
                          <div className="flex items-center gap-1.5 min-w-0"><Music size={12} className="shrink-0" /><span className="truncate">{fav.songTitle}</span></div>
                          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground"><Clock size={12} /><span>{formatTime(fav.start)}</span></div>
                        </div>
                      </Link>
                      <div className="flex flex-col border-l">
                        <button onClick={() => removeFavorite(fav.id)} className="flex-1 px-4 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={18} /></button>
                        <Link href={`/learn?v=${fav.videoId}`} className="flex-1 px-4 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"><ChevronRight size={18} /></Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Quote size={32} />}
              title="尚無收藏內容"
              desc="在影片學習中點擊「⭐」即可將喜歡的句子收藏到這裡。"
            />
          )}
        </TabsContent>

        {/* ── Tab 2: 歌曲列表（單字集合）────────────────────────────── */}
        <TabsContent value="songs" className="mt-0">
          {songContributions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground px-1">點擊任一歌曲，查看它貢獻了哪些字典條目</p>
              {songContributions.map((song) => {
                const meta = historyItems.find(h => h.videoId === song.videoId);
                return (
                  <Card
                    key={song.videoId}
                    className="border-none shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden group active:scale-[0.99]"
                    onClick={() => setOpenSong(song.videoId)}
                  >
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                        <Disc3 size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold truncate">{song.songTitle}</h3>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {meta?.artistName ? `${meta.artistName} ・ ` : ''}
                          貢獻 <span className="text-primary font-bold">{song.entryIds.length}</span> 個單字
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" size={18} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={32} />}
              title="尚無單字收藏"
              desc="在歌詞頁面收藏單字後，這裡會顯示每首歌的字典貢獻。"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── 歌曲詳情 Dialog ────────────────────────────────────────── */}
      <Dialog open={!!openSong} onOpenChange={(open) => !open && setOpenSong(null)}>
        <DialogContent className="rounded-3xl max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Disc3 size={18} className="text-indigo-600" />
              {openSongData?.songTitle ?? ''}
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground">
              這首歌貢獻了 <span className="font-bold text-primary">{openSongEntries.length}</span> 個字典條目
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {openSongEntries.map(entry => (
              <Link
                key={entry.id}
                href="/dictionary"
                onClick={() => setOpenSong(null)}
                className="block p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold truncate">{entry.word}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.reading} ・ {entry.romaji}
                      {entry.wordTranslation && ` ・ ${entry.wordTranslation}`}
                    </p>
                  </div>
                  {entry.mastered && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 shrink-0">已熟練</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {openSongData && (
            <div className="p-3 border-t">
              <Link href={`/learn?v=${openSongData.videoId}`} onClick={() => setOpenSong(null)}>
                <Button className="w-full rounded-xl gap-2"><Music size={14} /> 回到此歌詞頁</Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="space-y-1">
        <p className="text-lg font-bold text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground/60 px-8">{desc}</p>
      </div>
      <Link href="/"><Button className="rounded-xl mt-4">去探索影片</Button></Link>
    </div>
  );
}

function Quote({ size, className }: { size?: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4.5 4 6" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4.5 4 6" />
    </svg>
  );
}
