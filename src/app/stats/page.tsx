"use client"

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useDictionaryStore, useFavoriteStore, useStreakStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { ArrowLeft, BookOpen, Flame, Star, TrendingUp, Award, Music } from "lucide-react";

const PIE_COLORS = ["#10b981", "#f59e0b"]; // 已熟練 / 學習中
const BAR_COLOR  = "#6366f1";

export default function StatsPage() {
  const { entries }      = useDictionaryStore();
  const { items: favs }  = useFavoriteStore();
  const { streak }       = useStreakStore();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  // ── 近 30 日新增單字數 ─────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const md  = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({ date: key, label: md, count: 0 });
    }
    entries.forEach(e => {
      const day = e.addedDate?.split('T')[0];
      const target = days.find(d => d.date === day);
      if (target) target.count++;
    });
    return days;
  }, [entries]);

  // ── 各歌曲收藏分布（取前 8 名）────────────────────────────────────────
  const songData = useMemo(() => {
    const counter = new Map<string, number>();
    entries.forEach(e => {
      e.sources.forEach(s => {
        if (!s.songTitle) return;
        counter.set(s.songTitle, (counter.get(s.songTitle) ?? 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .map(([title, count]) => ({ title, count, short: title.length > 14 ? title.slice(0, 13) + '…' : title }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [entries]);

  // ── 熟練 / 學習中比例 ─────────────────────────────────────────────────
  const masteryData = useMemo(() => {
    const mastered = entries.filter(e => e.mastered).length;
    const learning = entries.length - mastered;
    return [
      { name: '已熟練', value: mastered },
      { name: '學習中', value: learning },
    ];
  }, [entries]);

  const total7d  = dailyData.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const total30d = dailyData.reduce((sum, d) => sum + d.count, 0);
  const masteryRatio = entries.length > 0 ? Math.round(masteryData[0].value / entries.length * 100) : 0;

  return (
    <div className="space-y-6 px-6 py-6 pb-24">
      <header className="flex items-center gap-4">
        <Link href="/dashboard"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft /></Button></Link>
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary">學習統計</h1>
          <p className="text-xs text-muted-foreground font-medium">數據洞察你的學習軌跡</p>
        </div>
      </header>

      {/* ── 概覽四欄 ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={BookOpen} label="字典單字" value={entries.length} color="bg-indigo-500" />
        <SummaryCard icon={Star}     label="收藏句子" value={favs.length}    color="bg-amber-500" />
        <SummaryCard icon={Flame}    label="連續打卡"   value={`${streak.current} 天`} color="bg-orange-500" />
        <SummaryCard icon={Award}    label="熟練比例"   value={`${masteryRatio}%`}     color="bg-emerald-500" />
      </div>

      {/* ── 每日新增單字數 ────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <TrendingUp size={14} /> 每日新增單字數（近 30 日）
          </h2>
          <span className="text-[10px] text-muted-foreground">7 日 +{total7d} ・ 30 日 +{total30d}</span>
        </div>
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            {dailyData.every(d => d.count === 0) ? (
              <EmptyChart text="尚無資料 — 開始收藏單字後就會在這裡看到趨勢" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: any) => [`${v} 字`, '新增']}
                  />
                  <Line type="monotone" dataKey="count" stroke={BAR_COLOR} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── 歌曲收藏分布 ──────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <Music size={14} /> 歌曲收藏分布（前 8 名）
        </h2>
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            {songData.length === 0 ? (
              <EmptyChart text="收藏單字後將顯示來源歌曲的分布" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, songData.length * 32)}>
                <BarChart layout="vertical" data={songData} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="short" tick={{ fontSize: 10 }} width={110} interval={0} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: any) => [`${v} 字`, '貢獻']}
                    labelFormatter={(l: any, payload: any) => payload?.[0]?.payload?.title ?? l}
                  />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── 熟練 / 學習中比例 ─────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <Award size={14} /> 熟練 / 學習中比例
        </h2>
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            {entries.length === 0 ? (
              <EmptyChart text="尚無單字" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={masteryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name} ${entry.value}`}
                    labelLine={false}
                  >
                    {masteryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: any, name: any) => [`${v} 字`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground/70">
      {text}
    </div>
  );
}
