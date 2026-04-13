
"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VocabularyData, VocabularyWord } from "@/lib/constants/data";
import { useProgressStore } from "@/store/use-app-store";
import { FlipCard } from "@/components/FlipCard";
import { QuizEngine } from "@/components/QuizEngine";
import { useState, useEffect, useCallback } from "react";
import {
  Mic2,
  LayoutGrid,
  ChevronRight,
  Volume2,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  RotateCw,
  Layers,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/speech";

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- Echo Method View ---
function EchoMethodView({ onBack }: { onBack: () => void }) {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setWords(shuffle(VocabularyData.words));
  }, []);

  useEffect(() => {
    if (words.length > 0) {
      const timer = setTimeout(() => {
        speak(words[currentIndex].word);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [words, currentIndex]);

  const handleNext = () => {
    setIsRevealed(false);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= words.length) {
      setWords(shuffle(VocabularyData.words));
      setCurrentIndex(0);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const currentWord = words[currentIndex];
  if (!currentWord) return null;

  return (
    <div className="flex flex-col h-full space-y-8 py-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button>
        <h2 className="text-xl font-bold">回音法</h2>
      </div>
      <div className="text-center"><p className="text-muted-foreground text-sm">聽發音，在心裡跟讀，然後點擊畫面看答案</p></div>
      <div className="flex-1 flex flex-col items-center justify-center space-y-12">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping" />
          <div className="relative w-48 h-48 rounded-full bg-indigo-500/10 flex items-center justify-center cursor-pointer hover:bg-indigo-500/20 transition-all shadow-inner active:scale-95 group" onClick={() => speak(currentWord.word)}>
            <Volume2 size={80} className="text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
        </div>
        <div className="min-h-[160px] flex flex-col items-center justify-center w-full px-6">
          {isRevealed ? (
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-xl text-muted-foreground font-medium">{currentWord.furigana}</p>
              <h3 className="text-5xl font-bold text-primary">{currentWord.word}</h3>
              <p className="text-2xl text-indigo-600 font-bold">{currentWord.translation}</p>
            </div>
          ) : (
            <Button variant="outline" className="h-14 px-8 rounded-2xl bg-indigo-500/5 border-indigo-200 text-indigo-600 font-bold shadow-sm" onClick={() => setIsRevealed(true)}>點擊顯示答案</Button>
          )}
        </div>
      </div>
      <div className="pb-8">
        <Button className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50" disabled={!isRevealed} onClick={handleNext}>下一個</Button>
      </div>
    </div>
  );
}

// --- Matching Game View ---
interface MatchingCard { id: string; text: string; pairId: string; isFaceUp: boolean; isMatched: boolean; }

function MatchingGameView({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<MatchingCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<MatchingCard[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  const setupGame = useCallback(() => {
    const randomWords = shuffle(VocabularyData.words).slice(0, 6);
    let newCards: MatchingCard[] = [];
    randomWords.forEach((word) => {
      const pairId = Math.random().toString(36).substring(2, 9);
      newCards.push({ id: Math.random().toString(36).substring(2, 9), text: word.word, pairId, isFaceUp: false, isMatched: false });
      newCards.push({ id: Math.random().toString(36).substring(2, 9), text: word.translation, pairId, isFaceUp: false, isMatched: false });
    });
    setCards(shuffle(newCards));
    setIsGameOver(false);
    setSelectedCards([]);
  }, []);

  useEffect(() => { setupGame(); }, [setupGame]);

  const handleTap = (card: MatchingCard) => {
    if (card.isMatched || selectedCards.length >= 2 || selectedCards.find(c => c.id === card.id)) return;
    const updatedCards = cards.map(c => c.id === card.id ? { ...c, isFaceUp: true } : c);
    setCards(updatedCards);
    const newSelected = [...selectedCards, { ...card, isFaceUp: true }];
    setSelectedCards(newSelected);
    if (newSelected.length === 2) checkForMatch(newSelected, updatedCards);
  };

  const checkForMatch = (selected: MatchingCard[], currentCards: MatchingCard[]) => {
    const [c1, c2] = selected;
    if (c1.pairId === c2.pairId) {
      setTimeout(() => {
        const matchedCards = currentCards.map(c => (c.id === c1.id || c.id === c2.id) ? { ...c, isMatched: true } : c);
        setCards(matchedCards);
        setSelectedCards([]);
        if (matchedCards.every(c => c.isMatched)) setIsGameOver(true);
      }, 500);
    } else {
      setTimeout(() => {
        setCards(prev => prev.map(c => (c.id === c1.id || c.id === c2.id) ? { ...c, isFaceUp: false } : c));
        setSelectedCards([]);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 py-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h2 className="text-xl font-bold">記憶配對遊戲</h2></div>
      <div className="flex-1 flex flex-col justify-center">
        {isGameOver ? (
          <div className="text-center space-y-6 py-12"><h3 className="text-4xl font-bold animate-bounce text-primary">🎉 完美配對！</h3><Button onClick={setupGame} className="rounded-2xl h-14 px-10 bg-teal-600 hover:bg-teal-700 text-lg font-bold shadow-lg"><RotateCcw className="mr-2" size={20} /> 再玩一次</Button></div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {cards.map((card) => (
              <div key={card.id} onClick={() => handleTap(card)} className={cn("h-28 rounded-2xl flex flex-col items-center justify-center p-3 text-center transition-all duration-300 cursor-pointer shadow-sm relative overflow-hidden border-2", card.isMatched ? "bg-green-50 border-green-200" : (card.isFaceUp ? "bg-card border-teal-500 scale-105 z-10" : "bg-teal-600 border-teal-600 hover:bg-teal-500 shadow-md"))}>
                {card.isMatched ? <div className="flex flex-col items-center gap-1 animate-in zoom-in-90 duration-300"><CheckCircle2 size={28} className="text-green-600" /><span className="text-xs font-bold text-green-700 leading-tight">{card.text}</span></div> : (card.isFaceUp && <span className="text-sm font-bold leading-tight text-foreground">{card.text}</span>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Flashcard View ---
function FlashcardView({ onBack }: { onBack: () => void }) {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { addVocab } = useProgressStore();

  useEffect(() => { setWords(shuffle(VocabularyData.words)); }, []);

  const handleFlip = () => { if (!isFlipped) speak(words[currentIndex].word); setIsFlipped(!isFlipped); };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < words.length - 1) setCurrentIndex(currentIndex + 1);
    else { addVocab(); setWords(shuffle(VocabularyData.words)); setCurrentIndex(0); }
  };

  const handlePrev = () => { setIsFlipped(false); setCurrentIndex(prev => Math.max(0, prev - 1)); };

  const currentWord = words[currentIndex];
  if (!currentWord) return null;

  return (
    <div className="flex flex-col h-full space-y-8 py-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h2 className="text-xl font-bold">單字閃卡</h2></div>
        <span className="text-sm font-mono font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">{currentIndex + 1} / {words.length}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <FlipCard isFlipped={isFlipped} onFlip={handleFlip} className="w-full max-w-[300px] h-[400px]" front={<div className="flex flex-col items-center justify-center text-center space-y-6"><p className="text-xl text-muted-foreground">{currentWord.furigana}</p><h3 className="text-6xl font-bold text-primary break-all">{currentWord.word}</h3><p className="mt-12 text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">點擊翻轉看中文</p></div>} back={<div className="flex flex-col items-center justify-center text-center space-y-6"><h3 className="text-4xl font-bold text-foreground mb-6">{currentWord.translation}</h3><div className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-sm font-bold">分類：{currentWord.category}</div></div>} />
      </div>
      <div className="flex items-center justify-center gap-8 pb-12">
        <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2" disabled={currentIndex === 0} onClick={handlePrev}><ChevronLeft size={32} /></Button>
        <Button variant="secondary" size="icon" className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" onClick={() => speak(currentWord.word)}><Volume2 size={32} /></Button>
        <Button variant="outline" size="icon" className={cn("w-16 h-16 rounded-full border-2", currentIndex === words.length - 1 ? "text-green-600 border-green-200 bg-green-50" : "text-primary")} onClick={handleNext}>{currentIndex < words.length - 1 ? <ChevronRightIcon size={32} /> : <RotateCw size={32} />}</Button>
      </div>
    </div>
  );
}


// --- Main Practice Page ---
export default function PracticePage() {
  const [view, setView] = useState<'home' | 'echo' | 'matching' | 'flashcard' | 'quiz'>('home');

  if (view === 'echo') return <div className="px-4 h-[calc(100vh-64px)]"><EchoMethodView onBack={() => setView('home')} /></div>;
  if (view === 'matching') return <div className="px-4 h-[calc(100vh-64px)]"><MatchingGameView onBack={() => setView('home')} /></div>;
  if (view === 'flashcard') return <div className="px-4 h-[calc(100vh-64px)]"><FlashcardView onBack={() => setView('home')} /></div>;
  if (view === 'quiz') return <div className="px-4 h-[calc(100vh-64px)]"><QuizEngine onBack={() => setView('home')} /></div>;

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="py-4">
        <h1 className="text-3xl font-headline font-bold text-primary">練習實驗室</h1>
        <p className="text-muted-foreground font-medium">選擇您的訓練方式，精進日語能力</p>
      </header>
      <div className="space-y-4 pb-20">
        <PracticeCard icon={Layers} title="單字閃卡" desc="沉浸式翻牌記憶，配合語音朗讀" color="bg-indigo-100 text-indigo-600" onClick={() => setView('flashcard')} />
        <PracticeCard icon={Mic2} title="回音法 (Echo Method)" desc="聽發音，在心裡跟讀，然後點擊看答案" color="bg-purple-100 text-purple-600" onClick={() => setView('echo')} />
        <PracticeCard icon={LayoutGrid} title="記憶配對遊戲" desc="將日文與正確的中文意思連線配對" color="bg-teal-100 text-teal-600" onClick={() => setView('matching')} />
        <PracticeCard icon={GraduationCap} title="綜合測驗" desc="挑戰 10 題隨機選題，檢驗學習成果" color="bg-orange-100 text-orange-600" onClick={() => setView('quiz')} />
      </div>
    </div>
  );
}

function PracticeCard({ icon: Icon, title, desc, color, onClick }: { icon: any, title: string, desc: string, color: string, onClick: () => void }) {
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden group active:scale-[0.98]" onClick={onClick}>
      <CardContent className="p-6 flex items-center gap-6">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", color)}><Icon size={32} /></div>
        <div className="flex-1"><h3 className="text-lg font-bold">{title}</h3><p className="text-xs text-muted-foreground font-medium">{desc}</p></div>
        <ChevronRight className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </CardContent>
    </Card>
  );
}
