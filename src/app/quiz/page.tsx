
"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { VocabularyData, VocabularyWord } from "@/lib/constants/data";
import { useProgressStore } from "@/store/use-app-store";
import { 
  CheckCircle2, 
  XCircle, 
  GraduationCap, 
  Trophy, 
  ArrowRight,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizOption { text: string; index: number; }
interface Question { word: VocabularyWord; options: QuizOption[]; correctIndex: number; }
type QuizView = "home" | "playing" | "result";

export default function QuizPage() {
  const [view, setView] = useState<QuizView>("home");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { progress, updateHighScore } = useProgressStore();
  useEffect(() => { setIsMounted(true); }, []);
  const generateQuestions = () => {
    const allWords = [...VocabularyData.words].sort(() => 0.5 - Math.random());
    const selected = allWords.slice(0, 10);
    const generated = selected.map((word) => {
      const wrongOptions = allWords.filter(w => w.word !== word.word).sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.translation);
      const texts = [...wrongOptions, word.translation].sort(() => 0.5 - Math.random());
      const correctIdx = texts.indexOf(word.translation);
      return { word, options: texts.map((text, index) => ({ text, index })), correctIndex: correctIdx };
    });
    setQuestions(generated); setCurrentIndex(0); setScore(0); setSelectedOption(null); setIsAnswered(false); setView("playing");
  };
  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index); setIsAnswered(true);
    if (index === questions[currentIndex].correctIndex) { setScore(s => s + 10); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20); }
    else { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]); }
  };
  const nextQuestion = () => { if (currentIndex < questions.length - 1) { setCurrentIndex(prev => prev + 1); setSelectedOption(null); setIsAnswered(false); } else { updateHighScore(score); setView("result"); } };
  if (!isMounted) return null;

  if (view === "home") {
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] space-y-10 px-6 animate-in fade-in duration-500"><div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary"><GraduationCap size={60} /></div><div className="text-center space-y-3"><h1 className="text-4xl font-headline font-bold text-primary">綜合測驗</h1><div className="flex items-center justify-center gap-2 text-muted-foreground"><Trophy size={16} className="text-orange-500" /><p className="text-sm font-medium">最高分：<span className="text-primary font-bold">{progress.quizHighScore}</span> 分</p></div></div><Button onClick={generateQuestions} className="w-full max-w-xs h-14 text-lg font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95">開始測驗 (10題)</Button></div>);
  }
  if (view === "result") {
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] space-y-10 px-6 animate-in zoom-in-95 duration-500"><div className="text-center space-y-4"><h1 className="text-4xl font-headline font-bold text-primary">{score >= 80 ? "🏆 太棒了！" : "📚 再接再厲！"}</h1><p className="text-muted-foreground font-medium">這是您今天的學習成果</p></div><div className="relative w-56 h-56 flex items-center justify-center"><svg className="w-full h-full -rotate-90"><circle cx="112" cy="112" r="100" fill="transparent" stroke="currentColor" strokeWidth="16" className="text-primary/10" /><circle cx="112" cy="112" r="100" fill="transparent" stroke="currentColor" strokeWidth="16" strokeDasharray={628} strokeDashoffset={628 * (1 - score/100)} strokeLinecap="round" className="text-accent transition-all duration-1000 ease-out" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-7xl font-black font-body text-primary">{score}</span><span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">分</span></div></div><div className="space-y-4 w-full max-w-xs"><Button onClick={generateQuestions} className="w-full h-14 text-lg font-bold rounded-2xl shadow-md gap-2"><RotateCcw size={20} /> 再試一次</Button></div></div>);
  }
  const currentQuestion = questions[currentIndex]; if (!currentQuestion) return null;
  return (
    <div className="space-y-8 px-4 py-6 animate-in slide-in-from-right-4 duration-300">
      <header className="space-y-4"><div className="flex justify-between items-center px-1"><span className="text-xs font-black text-primary uppercase tracking-widest">單字隨堂測驗</span><span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">{currentIndex + 1} / 10</span></div><div className="w-full bg-muted h-2 rounded-full overflow-hidden"><div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${((currentIndex + 1) / 10) * 100}%` }} /></div></header>
      <div className="bg-card rounded-[2.5rem] border-2 border-primary/5 p-10 shadow-xl text-center space-y-6 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5"><GraduationCap size={100} /></div><div className="space-y-3 relative z-10"><p className="text-primary/60 text-xs font-bold uppercase tracking-widest">{currentQuestion.word.category}</p><h2 className="text-6xl font-headline font-bold text-primary">{currentQuestion.word.word}</h2><p className="text-xl text-muted-foreground font-medium">{currentQuestion.word.furigana}</p></div><div className="pt-4"><p className="text-sm font-bold text-muted-foreground/80">這個單字的意思是？</p></div></div>
      <div className="grid grid-cols-1 gap-4">{currentQuestion.options.map((opt, i) => { const isCorrect = opt.index === currentQuestion.correctIndex; const isSelected = selectedOption === i; return (<button key={`${currentIndex}-${i}`} disabled={isAnswered} onClick={() => handleAnswer(i)} className={cn("h-16 px-6 rounded-2xl border-2 transition-all flex items-center justify-between text-left group active:scale-[0.98]", !isAnswered && "bg-card border-border hover:border-primary hover:bg-primary/5", isAnswered && isCorrect && "bg-green-50 border-green-500 text-green-700 shadow-sm", isAnswered && isSelected && !isCorrect && "bg-destructive/5 border-destructive text-destructive shadow-sm", isAnswered && !isCorrect && !isSelected && "opacity-40 grayscale-[0.5] border-border bg-muted/20")}><span className="text-lg font-bold">{opt.text}</span>{isAnswered && isCorrect && <CheckCircle2 size={24} className="text-green-500 animate-in zoom-in-50" />}{isAnswered && isSelected && !isCorrect && <XCircle size={24} className="text-destructive animate-in shake-1" />}</button>); })}</div>
      {isAnswered && (<div className="pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300"><Button onClick={nextQuestion} className="w-full h-16 text-lg font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">{currentIndex < 9 ? "下一題" : "查看測驗結果"} <ArrowRight size={20} /></Button></div>)}
    </div>
  );
}
