"use client"

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  useProgressStore, 
  useStreakStore, 
  useDictionaryStore, 
  useFavoriteStore 
} from "@/store/use-app-store";
import { VocabularyData } from "@/lib/constants/data";
import { 
  Trophy, 
  BookText, 
  Type, 
  Zap, 
  Book, 
  Award, 
  Star,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

function CircularProgress({ progress, size = 160, strokeWidth = 12 }: { progress: number, size?: number, strokeWidth?: number }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  useEffect(() => {
    const timer = setTimeout(() => { setAnimatedProgress(Math.min(progress, 1)); }, 100);
    return () => clearTimeout(timer);
  }, [progress]);
  const offset = circumference - animatedProgress * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]"><circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-primary/10" /><circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-in-out' }} strokeLinecap="round" className="text-primary" /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold font-body">{Math.round(progress * 100)}%</span></div>
    </div>
  );
}

function StatCard({ title, value, total, icon: Icon, colorClass }: { title: string, value: string | number, total?: string, icon: any, colorClass: string }) {
  return (
    <Card className="border-none shadow-md overflow-hidden group hover:shadow-lg transition-all duration-300">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform group-hover:scale-110", colorClass)}><Icon size={22} /></div>
        <div className="space-y-1"><div className="flex items-baseline gap-1"><span className="text-2xl font-bold font-body">{value}</span>{total && <span className="text-[10px] font-bold text-muted-foreground uppercase">{total}</span>}</div><p className="text-xs text-muted-foreground font-medium">{title}</p></div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { progress, checkDailyReset } = useProgressStore();
  const { streak, checkIn } = useStreakStore();
  const { entries } = useDictionaryStore();
  const { items: favoriteItems } = useFavoriteStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { 
    setIsMounted(true); 
    checkIn(); 
    checkDailyReset(); 
  }, [checkIn, checkDailyReset]);

  // 模擬最近 7 天的數據 (移植自 Swift 的活動追蹤邏輯)
  const chartData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const today = new Date().getDay(); // 0 is Sun, 1 is Mon
    const shiftedDays = [...days.slice(today), ...days.slice(0, today)];
    
    return shiftedDays.map((day, idx) => ({
      name: day,
      count: idx === shiftedDays.length - 1 ? (progress.dailyKanaCount + progress.dailyVocabCount) : Math.floor(Math.random() * 30) + 10
    }));
  }, [progress.dailyKanaCount, progress.dailyVocabCount]);

  if (!isMounted) return null;

  const totalVocab = VocabularyData.words.length;
  const dailyInteractions = progress.dailyKanaCount + progress.dailyVocabCount;
  const dailyGoalProgress = Math.min(dailyInteractions / 20, 1);
  const masteredCount = entries.filter(e => e.mastered).length;
  const uniqueSongCount = new Set(favoriteItems.map(item => item.videoId)).size;

  return (
    <div className="space-y-8 px-6 py-6 pb-24">
      <header className="space-y-1">
        <h1 className="text-3xl font-headline font-bold text-primary">學習統計</h1>
        <p className="text-muted-foreground text-sm font-medium">堅持下去，每天都有進步！ 🎌</p>
      </header>

      <Card className="border-none shadow-lg bg-card overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={120} /></div>
        <CardContent className="p-8 flex flex-col items-center gap-6">
          <h2 className="text-lg font-bold">今日互動目標</h2>
          <CircularProgress progress={dailyGoalProgress} />
          <p className="text-sm text-muted-foreground font-medium">今日已完成 <span className="text-primary font-bold">{dailyInteractions}</span> / 20 次互動</p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Activity size={18} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">學習活躍度</h2>
        </div>
        <Card className="border-none shadow-md overflow-hidden bg-card h-64">
          <CardContent className="p-4 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-3 gap-1 p-4 bg-card rounded-2xl shadow-md border border-border/50">
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-black text-orange-500 font-body">{streak.current}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">目前連勝</span>
        </div>
        <div className="w-px bg-border h-8 self-center" />
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-black text-primary font-body">{streak.longest}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">最長紀錄</span>
        </div>
        <div className="w-px bg-border h-8 self-center" />
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-black text-green-600 font-body">{streak.total}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">總天數</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="單字掌握度" value={progress.learnedVocabularyCount} total={`/ ${totalVocab}`} icon={BookText} colorClass="bg-teal-500" />
        <StatCard title="測驗最高分" value={progress.quizHighScore} total="分" icon={Trophy} colorClass="bg-orange-500" />
        <StatCard title="假名學習" value={progress.learnedKanaCount} total="次" icon={Type} colorClass="bg-pink-500" />
        <StatCard title="累積互動" value={progress.learnedKanaCount + progress.learnedVocabularyCount} total="次" icon={Zap} colorClass="bg-blue-500" />
        <StatCard title="字典收藏" value={entries.length} total="個" icon={Book} colorClass="bg-purple-500" />
        <StatCard title="已熟練" value={masteredCount} total={`/ ${entries.length}`} icon={Award} colorClass="bg-green-600" />
      </div>

      {favoriteItems.length > 0 && (
        <Card className="border-none shadow-md bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600">
              <Star size={24} fill="currentColor" />
            </div>
            <div>
              <h3 className="font-bold">收藏的句子</h3>
              <p className="text-xs text-muted-foreground font-medium">共 <span className="text-primary font-bold">{favoriteItems.length}</span> 句，來自 <span className="text-primary font-bold">{uniqueSongCount}</span> 部影片</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
