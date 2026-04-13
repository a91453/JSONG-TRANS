
"use client"

import { useFavoriteStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Trash2, Music, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatTime } from "@/lib/utils";

export default function FavoritesPage() {
  const { items, removeFavorite } = useFavoriteStore();

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft /></Button></Link>
        <h1 className="text-2xl font-headline font-bold text-primary">收藏的句子</h1>
      </header>
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((fav) => (
            <Card key={fav.id} className="overflow-hidden border-none shadow-md group">
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  <Link href={`/learn?v=${fav.videoId}`} className="flex-1 p-4 space-y-3 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1"><p className="text-lg font-bold leading-tight">{fav.japanese}</p><p className="text-sm text-muted-foreground">{fav.translation}</p></div>
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
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Quote size={32} /></div>
          <div className="space-y-1"><p className="text-lg font-bold text-muted-foreground">尚無收藏內容</p><p className="text-sm text-muted-foreground/60 px-8">在影片學習中點擊「⭐」即可將喜歡的句子收藏到這裡。</p></div>
          <Link href="/"><Button className="rounded-xl mt-4">去探索影片</Button></Link>
        </div>
      )}
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
