
"use client"

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VocabularyData } from "@/lib/constants/data";
import { useProgressStore, useDictionaryStore } from "@/store/use-app-store";
import {
  CheckCircle2,
  XCircle,
  GraduationCap,
  Trophy,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Book,
  Library,
  Music2
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 統一題卡格式：靜態詞庫與使用者字典都會轉換成此型別。
 * - source 在「我的字典」模式下提供來源歌曲與原句，作為題目情境提示。
 */
interface QuizCard {
  word:        string;
  furigana:    string;
  translation: string;
  category:    string;
  source?: { songTitle: string; sentence: string };
}

interface QuizOption { text: string; index: number; }
interface Question   { card: QuizCard; options: QuizOption[]; correctIndex: number; }

type QuizMode = 'dictionary' | 'comprehensive';

interface QuizEngineProps {
  onBack?: () => void;
}

// Fisher-Yates 洗牌（避免 sort(() => 0.5 - Math.random()) 的偏差）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 至少需要 4 個唯一翻譯才能組成「正解 + 3 干擾」選項
const MIN_FOR_QUIZ = 4;

export function QuizEngine({ onBack }: QuizEngineProps) {
  const [view,           setView]           = useState<"home" | "playing" | "result">("home");
  const [questions,      setQuestions]      = useState<Question[]>([]);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [score,          setScore]          = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered,     setIsAnswered]     = useState(false);

  const { progress, updateHighScore } = useProgressStore();
  const { entries }                   = useDictionaryStore();

  // 將使用者字典轉成題卡格式（句子翻譯作為「答案」測試使用者對歌詞含義的記憶）
  const dictCards = useMemo<QuizCard[]>(() => entries
    .filter(e => e.sources.length > 0 && e.sources[0].translation.trim())
    .map(e => ({
      word:        e.word,
      furigana:    e.reading,
      translation: e.sources[0].translation,
      category:    e.sources[0].songTitle,
      source:      { songTitle: e.sources[0].songTitle, sentence: e.sources[0].sentence },
    })),
  [entries]);

  const staticCards = useMemo<QuizCard[]>(() => VocabularyData.words.map(w => ({
    word:        w.word,
    furigana:    w.furigana,
    translation: w.translation,
    category:    w.category,
  })), []);

  const dictReady = dictCards.length >= MIN_FOR_QUIZ;
  const [mode, setMode] = useState<QuizMode>(dictReady ? 'dictionary' : 'comprehensive');

  const generateQuestions = () => {
    const sourceCards = mode === 'dictionary' ? dictCards : staticCards;
    if (sourceCards.length < MIN_FOR_QUIZ) return;

    const shuffled  = shuffle(sourceCards);
    const numQs     = Math.min(10, shuffled.length);
    const selected  = shuffled.slice(0, numQs);
    const generated = selected.map((card) => {
      // 干擾選項：從同來源池抽 3 個翻譯不重複的卡
      const distractors = shuffle(
        sourceCards.filter(c => c.translation !== card.translation),
      ).slice(0, 3);
      const correctId = crypto.randomUUID();
      const opts = shuffle([
        ...distractors.map(d => ({ text: d.translation, id: crypto.randomUUID() })),
        { text: card.translation, id: correctId },
      ]);
      const correctIdx = opts.findIndex(o => o.id === correctId);
      return {
        card,
        options:      opts.map((o, index) => ({ text: o.text, index })),
        correctIndex: correctIdx,
      };
    });
    setQuestions(generated); setCurrentIndex(0); setScore(0);
    setSelectedOption(null); setIsAnswered(false); setView("playing");
  };

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index); setIsAnswered(true);
    if (index === questions[currentIndex].correctIndex) {
      setScore(s => s + 10);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    } else {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1); setSelectedOption(null); setIsAnswered(false);
    } else {
      updateHighScore(score); setView("result");
    }
  };

  const containerClass = onBack ? "flex flex-col h-full" : "flex flex-col";
  const centeredClass = onBack
    ? "flex-1 flex flex-col items-center justify-center"
    : "flex flex-col items-center justify-center min-h-[calc(100vh-64px)]";

  // ── HOME ────────────────────────────────────────────────────────────────
  if (view === "home") {
    const dictTooSmall = !dictReady && mode === 'dictionary';
    return (
      <div className={cn(containerClass, "space-y-10 py-4 animate-in fade-in duration-500")}>
        {onBack && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button>
            <h2 className="text-xl font-bold">綜合測驗</h2>
          </div>
        )}
        <div className={cn(centeredClass, "space-y-8")}>
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
            <GraduationCap size={60} />
          </div>
          <div className="text-center space-y-3">
            <h1 className={cn("font-headline font-bold text-primary", onBack ? "text-3xl" : "text-4xl")}>單字能力測驗</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Trophy size={16} className="text-orange-500" />
              <p className="text-sm font-medium">最高分：<span className="text-primary font-bold">{progress.quizHighScore}</span> 分</p>
            </div>
          </div>

          {/* 模式切換 */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            <ModeCard
              icon={<Book size={22} />}
              title="我的字典"
              desc={dictReady ? `${dictCards.length} 個收藏單字` : '收藏不足'}
              active={mode === 'dictionary'}
              disabled={!dictReady}
              onClick={() => dictReady && setMode('dictionary')}
            />
            <ModeCard
              icon={<Library size={22} />}
              title="綜合詞庫"
              desc={`${staticCards.length} 個常用詞`}
              active={mode === 'comprehensive'}
              onClick={() => setMode('comprehensive')}
            />
          </div>

          {dictTooSmall ? (
            <div className="w-full max-w-xs space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                字典裡至少需要 {MIN_FOR_QUIZ} 個單字才能開始我的字典測驗。
              </p>
              <Button asChild className="w-full h-12 rounded-xl">
                <Link href="/">前往收藏單字</Link>
              </Button>
            </div>
          ) : (
            <Button
              onClick={generateQuestions}
              className="w-full max-w-xs h-14 text-lg font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              開始測驗 ({Math.min(10, mode === 'dictionary' ? dictCards.length : staticCards.length)} 題)
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ──────────────────────────────────────────────────────────────
  if (view === "result") {
    const totalScore  = questions.length * 10;
    const dialPercent = totalScore > 0 ? score / totalScore : 0;
    return (
      <div className={cn(containerClass, "items-center justify-center space-y-10 py-4 animate-in zoom-in-95 duration-500")}>
        <div className={centeredClass}>
          <div className="text-center space-y-4 mb-10">
            <h1 className="text-4xl font-headline font-bold text-primary">{dialPercent >= 0.8 ? "🏆 太棒了！" : "📚 再接再厲！"}</h1>
            <p className="text-muted-foreground font-medium">這是您今天的學習成果</p>
          </div>
          <div className="relative w-56 h-56 flex items-center justify-center mb-10">
            <svg className="w-full h-full -rotate-90">
              <circle cx="112" cy="112" r="100" fill="transparent" stroke="currentColor" strokeWidth="16" className="text-primary/10" />
              <circle cx="112" cy="112" r="100" fill="transparent" stroke="currentColor" strokeWidth="16" strokeDasharray={628} strokeDashoffset={628 * (1 - dialPercent)} strokeLinecap="round" className="text-accent transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-7xl font-black font-body text-primary">{score}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">分 / {totalScore}</span>
            </div>
          </div>
          <div className="space-y-4 w-full max-w-xs">
            <Button onClick={generateQuestions} className="w-full h-14 text-lg font-bold rounded-2xl shadow-md gap-2"><RotateCcw size={20} /> 再試一次</Button>
            <Button variant="ghost" onClick={() => setView('home')} className="w-full font-bold">返回首頁</Button>
            {onBack && <Button variant="ghost" onClick={onBack} className="w-full font-bold">返回實驗室</Button>}
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;
  const isDictMode = mode === 'dictionary';

  return (
    <div className={cn(containerClass, "space-y-8 py-4 animate-in slide-in-from-right-4 duration-300")}>
      <header className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-primary uppercase tracking-widest">
            {isDictMode ? '我的字典測驗' : '單字隨堂測驗'}
          </span>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <div className="bg-card rounded-[2.5rem] border-2 border-primary/5 p-10 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5"><GraduationCap size={100} /></div>
        <div className="space-y-3 relative z-10">
          <p className="text-primary/60 text-xs font-bold uppercase tracking-widest">
            {currentQuestion.card.category}
          </p>
          <h2 className="text-6xl font-headline font-bold text-primary break-all">{currentQuestion.card.word}</h2>
          <p className="text-xl text-muted-foreground font-medium">{currentQuestion.card.furigana}</p>
        </div>
        {isDictMode && currentQuestion.card.source ? (
          <div className="pt-4 space-y-2 relative z-10">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground/70">
              <Music2 size={12} />
              <span className="text-[11px] font-bold uppercase tracking-widest">{currentQuestion.card.source.songTitle}</span>
            </div>
            <p className="text-sm font-medium text-foreground/80 italic">「{currentQuestion.card.source.sentence}」</p>
            <p className="text-sm font-bold text-muted-foreground/80 pt-2">這句歌詞的意思是？</p>
          </div>
        ) : (
          <div className="pt-4"><p className="text-sm font-bold text-muted-foreground/80">這個單字的意思是？</p></div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {currentQuestion.options.map((opt, i) => {
          const isCorrect  = opt.index === currentQuestion.correctIndex;
          const isSelected = selectedOption === i;
          return (
            <button
              key={`${currentIndex}-${i}`}
              disabled={isAnswered}
              onClick={() => handleAnswer(i)}
              className={cn(
                "min-h-16 px-6 py-3 rounded-2xl border-2 transition-all flex items-center justify-between text-left group active:scale-[0.98]",
                !isAnswered && "bg-card border-border hover:border-primary hover:bg-primary/5",
                isAnswered && isCorrect && "bg-green-50 border-green-500 text-green-700 shadow-sm",
                isAnswered && isSelected && !isCorrect && "bg-destructive/5 border-destructive text-destructive shadow-sm",
                isAnswered && !isCorrect && !isSelected && "opacity-40 grayscale-[0.5] border-border bg-muted/20",
              )}
            >
              <span className="text-lg font-bold">{opt.text}</span>
              {isAnswered && isCorrect  && <CheckCircle2 size={24} className="text-green-500 animate-in zoom-in-50 shrink-0" />}
              {isAnswered && isSelected && !isCorrect && <XCircle size={24} className="text-destructive animate-in shake-1 shrink-0" />}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className="pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Button onClick={nextQuestion} className="w-full h-16 text-lg font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
            {currentIndex < questions.length - 1 ? "下一題" : "查看測驗結果"} <ArrowRight size={20} />
          </Button>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  icon, title, desc, active, disabled, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-all active:scale-95",
        active && !disabled && "border-primary bg-primary/5 shadow-md",
        !active && !disabled && "border-border bg-card hover:border-primary/40",
        disabled && "border-border bg-muted/30 opacity-60 cursor-not-allowed",
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", active && !disabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div className="text-center">
        <div className={cn("text-sm font-bold", active && !disabled ? "text-primary" : "text-foreground")}>{title}</div>
        <div className="text-[11px] text-muted-foreground font-medium">{desc}</div>
      </div>
    </button>
  );
}
