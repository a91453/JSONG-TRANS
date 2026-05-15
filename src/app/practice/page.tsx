
"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VocabularyData, VocabularyWord } from "@/lib/constants/data";
import { useProgressStore, useDictionaryStore, useHistoryStore } from "@/store/use-app-store";
import { FlipCard } from "@/components/FlipCard";
import { QuizEngine } from "@/components/QuizEngine";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Mic2,
  LayoutGrid,
  ChevronRight,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  RotateCw,
  Layers,
  GraduationCap,
  Headphones,
  Shuffle,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/speech";
import type { Segment, FuriganaItem, DictEntry } from "@/types";

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 將使用者收藏的字典條目轉成練習用的 VocabularyWord 形狀
// （以最早收藏的句子翻譯作為意義，category 顯示來源歌曲）
function useEffectiveWords(): { words: VocabularyWord[]; fromDictionary: boolean } {
  const { entries, hiddenPresets } = useDictionaryStore();
  return useMemo(() => {
    const dictWords: VocabularyWord[] = entries
      .filter(e => e.sources.length > 0 && e.sources[0].translation.trim())
      .map(e => ({
        word:        e.word,
        furigana:    e.reading,
        translation: e.sources[0].translation,
        category:    e.sources[0].songTitle || '我的字典',
      }));
    // 至少 6 個才能撐起記憶配對；不足則退回靜態詞庫（已排除使用者隱藏的預設詞）
    if (dictWords.length >= 6) return { words: dictWords, fromDictionary: true };
    const visiblePresets = VocabularyData.words.filter(w => !hiddenPresets.includes(w.word));
    return { words: visiblePresets, fromDictionary: false };
  }, [entries, hiddenPresets]);
}

// --- Echo Method View ---
function EchoMethodView({ onBack }: { onBack: () => void }) {
  const { words: source } = useEffectiveWords();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setWords(shuffle(source));
  }, [source]);

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
      setWords(shuffle(source));
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
  const { words: source } = useEffectiveWords();
  const [cards, setCards] = useState<MatchingCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<MatchingCard[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  const setupGame = useCallback(() => {
    const randomWords = shuffle(source).slice(0, 6);
    let newCards: MatchingCard[] = [];
    randomWords.forEach((word) => {
      const pairId = Math.random().toString(36).substring(2, 9);
      newCards.push({ id: Math.random().toString(36).substring(2, 9), text: word.word, pairId, isFaceUp: false, isMatched: false });
      newCards.push({ id: Math.random().toString(36).substring(2, 9), text: word.translation, pairId, isFaceUp: false, isMatched: false });
    });
    setCards(shuffle(newCards));
    setIsGameOver(false);
    setSelectedCards([]);
  }, [source]);

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
  const { words: source } = useEffectiveWords();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { addVocab } = useProgressStore();

  useEffect(() => { setWords(shuffle(source)); }, [source]);

  const handleFlip = () => { if (!isFlipped) speak(words[currentIndex].word); setIsFlipped(!isFlipped); };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < words.length - 1) setCurrentIndex(currentIndex + 1);
    else { addVocab(); setWords(shuffle(source)); setCurrentIndex(0); }
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
  const [view, setView] = useState<'home' | 'echo' | 'matching' | 'flashcard' | 'quiz' | 'dictation' | 'sentence-sort'>('home');
  const { words: effective, fromDictionary } = useEffectiveWords();
  const { entries: dictEntries } = useDictionaryStore();
  const { results: historyResults, items: historyItems } = useHistoryStore();
  // 句子排序遊戲可用的歷史句子數（取出≥3 個 furigana 的句子才有意思排）
  const sortableSentences = useMemo(() => {
    const out: { videoId: string; songTitle: string; segment: Segment }[] = [];
    Object.entries(historyResults).forEach(([videoId, resp]) => {
      const meta = historyItems.find(i => i.videoId === videoId);
      const songTitle = meta?.songTitle ?? '';
      resp.segments.forEach(seg => {
        if (seg.japanese && seg.furigana && seg.furigana.length >= 2) {
          out.push({ videoId, songTitle, segment: seg });
        }
      });
    });
    return out;
  }, [historyResults, historyItems]);

  if (view === 'echo') return <div className="px-4 h-[calc(100vh-64px)]"><EchoMethodView onBack={() => setView('home')} /></div>;
  if (view === 'matching') return <div className="px-4 h-[calc(100vh-64px)]"><MatchingGameView onBack={() => setView('home')} /></div>;
  if (view === 'flashcard') return <div className="px-4 h-[calc(100vh-64px)]"><FlashcardView onBack={() => setView('home')} /></div>;
  if (view === 'quiz') return <div className="px-4 h-[calc(100vh-64px)]"><QuizEngine onBack={() => setView('home')} /></div>;
  if (view === 'dictation') return <div className="px-4 h-[calc(100vh-64px)]"><DictationView onBack={() => setView('home')} /></div>;
  if (view === 'sentence-sort') return <div className="px-4 h-[calc(100vh-64px)]"><SentenceSortView onBack={() => setView('home')} sentences={sortableSentences} /></div>;

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="py-4">
        <h1 className="text-3xl font-headline font-bold text-primary">練習實驗室</h1>
        <p className="text-muted-foreground font-medium">選擇您的訓練方式，精進日語能力</p>
        <div className={cn(
          "mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
          fromDictionary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}>
          {fromDictionary
            ? `📚 練習題庫：我的字典（${effective.length} 個收藏單字）`
            : `📖 練習題庫：綜合詞庫（收藏 6 個以上自動切換）`}
        </div>
      </header>
      <div className="space-y-4 pb-20">
        <PracticeCard icon={Layers} title="單字閃卡" desc="沉浸式翻牌記憶，配合語音朗讀" badge={`${effective.length} 字`} badgeTone={fromDictionary ? 'primary' : 'muted'} color="bg-indigo-100 text-indigo-600" onClick={() => setView('flashcard')} />
        <PracticeCard icon={Mic2} title="回音法 (Echo Method)" desc="聽發音，在心裡跟讀，然後點擊看答案" badge={`${effective.length} 字`} badgeTone={fromDictionary ? 'primary' : 'muted'} color="bg-purple-100 text-purple-600" onClick={() => setView('echo')} />
        <PracticeCard icon={Headphones} title="聽寫模式" desc="聽單字發音，輸入正確的假名" badge={dictEntries.length >= 1 ? `${dictEntries.length} 字` : '需收藏單字'} badgeTone={dictEntries.length >= 1 ? 'primary' : 'warning'} color="bg-pink-100 text-pink-600" onClick={() => setView('dictation')} />
        <PracticeCard icon={Shuffle} title="句子排序遊戲" desc="把打散的歌詞重新排回原順序" badge={sortableSentences.length >= 1 ? `${sortableSentences.length} 句` : '需先分析歌詞'} badgeTone={sortableSentences.length >= 1 ? 'primary' : 'warning'} color="bg-amber-100 text-amber-600" onClick={() => setView('sentence-sort')} />
        <PracticeCard icon={LayoutGrid} title="記憶配對遊戲" desc="將日文與正確的中文意思連線配對" badge={effective.length >= 6 ? '6 對' : '需 6 個字'} badgeTone={effective.length >= 6 ? 'primary' : 'warning'} color="bg-teal-100 text-teal-600" onClick={() => setView('matching')} />
        <PracticeCard icon={GraduationCap} title="綜合測驗" desc="挑戰隨機選題，檢驗學習成果" badge={`${Math.min(10, effective.length)} 題`} badgeTone={effective.length >= 4 ? 'primary' : 'warning'} color="bg-orange-100 text-orange-600" onClick={() => setView('quiz')} />
      </div>
    </div>
  );
}

function PracticeCard({
  icon: Icon, title, desc, badge, badgeTone = 'muted', color, onClick,
}: {
  icon: any;
  title: string;
  desc: string;
  badge?: string;
  badgeTone?: 'primary' | 'muted' | 'warning';
  color: string;
  onClick: () => void;
}) {
  const badgeClass =
    badgeTone === 'primary' ? 'bg-primary/10 text-primary'
    : badgeTone === 'warning' ? 'bg-orange-100 text-orange-700'
    : 'bg-muted text-muted-foreground';
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden group active:scale-[0.98]" onClick={onClick}>
      <CardContent className="p-6 flex items-center gap-6">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0", color)}><Icon size={32} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold">{title}</h3>
            {badge && (
              <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", badgeClass)}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">{desc}</p>
        </div>
        <ChevronRight className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </CardContent>
    </Card>
  );
}

// --- Dictation View（聽寫模式）─────────────────────────────────────────────
function DictationView({ onBack }: { onBack: () => void }) {
  const { entries, markSeen } = useDictionaryStore();
  // 抽出有 reading 的條目
  const pool = useMemo(() => entries.filter(e => e.reading.trim()), [entries]);
  const [order, setOrder]   = useState<DictEntry[]>([]);
  const [idx, setIdx]       = useState(0);
  const [input, setInput]   = useState('');
  const [reveal, setReveal] = useState(false);
  const [score, setScore]   = useState({ right: 0, wrong: 0 });

  useEffect(() => { setOrder(shuffle(pool)); setIdx(0); setScore({ right: 0, wrong: 0 }); }, [pool]);

  const current = order[idx];
  const playAudio = useCallback(() => { if (current) speak(current.word); }, [current]);
  // 進到新題自動播一次
  useEffect(() => { if (current) { const t = setTimeout(() => speak(current.word), 400); return () => clearTimeout(t); } }, [current]);

  if (pool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Headphones size={32} /></div>
        <p className="text-base font-bold text-muted-foreground">尚無收藏單字</p>
        <p className="text-xs text-muted-foreground/70 px-8">先到歌詞頁面收藏單字，才能練習聽寫。</p>
        <Button variant="ghost" onClick={onBack} className="rounded-full"><ArrowLeft size={16} className="mr-1" /> 返回</Button>
      </div>
    );
  }

  if (!current) {
    // 題目跑完
    const total = score.right + score.wrong;
    return (
      <div className="flex flex-col h-full py-4 space-y-6">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h2 className="text-xl font-bold">聽寫結果</h2></div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-7xl font-bold text-primary">{score.right} / {total}</div>
          <p className="text-sm text-muted-foreground">{score.right >= total * 0.8 ? '太厲害了！👏' : '繼續練習，會越來越熟練的 💪'}</p>
          <Button onClick={() => { setOrder(shuffle(pool)); setIdx(0); setScore({ right: 0, wrong: 0 }); setInput(''); setReveal(false); }} className="rounded-xl"><RotateCw size={16} className="mr-1" /> 再來一輪</Button>
        </div>
      </div>
    );
  }

  // 比對：使用者輸入接受 reading（純假名）即可，也接受 word（漢字）
  const normalize = (s: string) => s.trim().replace(/\s+/g, '').replace(/[、。！？]/g, '');
  const isCorrect = !!input && (normalize(input) === normalize(current.reading) || normalize(input) === normalize(current.word));

  const submit = () => {
    if (!input.trim()) return;
    setReveal(true);
    setScore(s => isCorrect ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 });
    markSeen(current.id);
  };
  const next = () => { setIdx(i => i + 1); setInput(''); setReveal(false); };

  return (
    <div className="flex flex-col h-full py-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button>
        <span className="text-xs font-bold text-muted-foreground">{idx + 1} / {order.length} ・ ✓ {score.right} ・ ✗ {score.wrong}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        <button onClick={playAudio} className="w-32 h-32 rounded-full bg-pink-500 hover:bg-pink-600 active:scale-95 transition-all flex items-center justify-center text-white shadow-lg">
          <Volume2 size={56} />
        </button>
        <p className="text-xs text-muted-foreground">點擊重新播放</p>

        <Input
          value={input}
          onChange={(e) => { setInput(e.target.value); if (reveal) setReveal(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') reveal ? next() : submit(); }}
          placeholder="輸入假名 / 漢字"
          disabled={reveal}
          className={cn(
            "max-w-xs text-center text-2xl h-16 rounded-2xl font-bold",
            reveal && (isCorrect ? "border-green-500 bg-green-50" : "border-destructive bg-destructive/10")
          )}
          autoFocus
        />

        {reveal && (
          <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isCorrect
              ? <p className="text-base font-bold text-green-600 flex items-center gap-1 justify-center"><CheckCircle2 size={18} /> 答對了！</p>
              : <p className="text-base font-bold text-destructive flex items-center gap-1 justify-center"><XCircle size={18} /> 答錯了</p>}
            <p className="text-3xl font-bold text-primary">{current.word}</p>
            <p className="text-base text-muted-foreground">{current.reading} ・ {current.romaji}</p>
            {current.wordTranslation && <p className="text-sm text-muted-foreground">{current.wordTranslation}</p>}
          </div>
        )}

        {!reveal
          ? <Button onClick={submit} disabled={!input.trim()} className="w-32 rounded-xl">提交</Button>
          : <Button onClick={next} className="w-32 rounded-xl">下一題 →</Button>}
      </div>
    </div>
  );
}

// --- Sentence Sort View（句子排序遊戲）──────────────────────────────────────
type SortToken = { id: string; text: string };

/**
 * 將日文句子按 furigana 邊界拆成 tokens：
 *  - 每個 furigana.word 為一個 token（漢字塊）
 *  - 兩個 furigana 之間的純假名／符號合併為一個 token
 */
function tokenizeForSort(japanese: string, furigana: FuriganaItem[]): string[] {
  if (!furigana || furigana.length === 0) {
    // fallback：每 1-2 字一塊（避免太細碎）
    const out: string[] = [];
    for (let i = 0; i < japanese.length; i += 2) out.push(japanese.substring(i, i + 2));
    return out.filter(s => s.length > 0);
  }
  const tokens: string[] = [];
  let i = 0;
  let fIdx = 0;
  while (i < japanese.length) {
    const f = furigana[fIdx];
    if (f && japanese.substring(i, i + f.word.length) === f.word) {
      tokens.push(f.word);
      i += f.word.length;
      fIdx++;
    } else {
      let j = i;
      while (j < japanese.length) {
        const next = furigana[fIdx];
        if (next && japanese.substring(j, j + next.word.length) === next.word) break;
        j++;
      }
      const chunk = japanese.substring(i, j);
      if (chunk) tokens.push(chunk);
      i = j;
    }
  }
  return tokens;
}

function SentenceSortView({
  onBack,
  sentences,
}: {
  onBack: () => void;
  sentences: { videoId: string; songTitle: string; segment: Segment }[];
}) {
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  // 從歷史隨機抽，避免每次都跑同一句
  const [order, setOrder] = useState<typeof sentences>([]);
  useEffect(() => { setOrder(shuffle(sentences).slice(0, 20)); }, [sentences]);

  const current = order[puzzleIdx];
  const correctTokens = useMemo<string[]>(() => current ? tokenizeForSort(current.segment.japanese, current.segment.furigana) : [], [current]);
  // 排除單一 token 的句子（沒得排）
  const skip = current && correctTokens.length < 3;
  useEffect(() => { if (skip) setPuzzleIdx(i => i + 1); }, [skip]);

  const [bank, setBank]      = useState<SortToken[]>([]); // 待選區
  const [picked, setPicked]  = useState<SortToken[]>([]); // 已選區
  const [reveal, setReveal]  = useState(false);

  useEffect(() => {
    if (!current) return;
    const ids = correctTokens.map((t, i) => ({ id: `t-${puzzleIdx}-${i}`, text: t }));
    setBank(shuffle(ids));
    setPicked([]);
    setReveal(false);
  }, [current, correctTokens, puzzleIdx]);

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Shuffle size={32} /></div>
        <p className="text-base font-bold text-muted-foreground">尚未分析過任何歌曲</p>
        <p className="text-xs text-muted-foreground/70 px-8">先在首頁分析一首歌，才有句子可以排序。</p>
        <Button variant="ghost" onClick={onBack} className="rounded-full"><ArrowLeft size={16} className="mr-1" /> 返回</Button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col h-full py-4 space-y-6">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h2 className="text-xl font-bold">排序完成</h2></div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <p className="text-2xl font-bold text-primary">所有句子已練習完畢！</p>
          <Button onClick={() => { setOrder(shuffle(sentences).slice(0, 20)); setPuzzleIdx(0); }} className="rounded-xl"><RotateCw size={16} className="mr-1" /> 再來一輪</Button>
        </div>
      </div>
    );
  }

  const pickToken = (t: SortToken) => { setBank(b => b.filter(x => x.id !== t.id)); setPicked(p => [...p, t]); };
  const unpickToken = (t: SortToken) => { setPicked(p => p.filter(x => x.id !== t.id)); setBank(b => [...b, t]); };
  const userText    = picked.map(t => t.text).join('');
  const correctText = correctTokens.join('');
  const isCorrect   = userText === correctText;
  const allPicked   = bank.length === 0;

  return (
    <div className="flex flex-col h-full py-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft /></Button>
        <span className="text-xs font-bold text-muted-foreground">{puzzleIdx + 1} / {order.length}</span>
        <Button variant="ghost" size="sm" onClick={() => speak(current.segment.japanese)} className="rounded-full text-xs"><Volume2 size={14} className="mr-1" /> 朗讀</Button>
      </div>

      {/* 翻譯提示 */}
      <Card className="border-none shadow-sm bg-amber-50">
        <CardContent className="p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">中文意思</p>
          <p className="text-sm font-bold text-amber-900">{current.segment.translation}</p>
        </CardContent>
      </Card>

      {/* 已選區 */}
      <div className="min-h-[80px] p-4 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20">
        {picked.length === 0
          ? <p className="text-xs text-center text-muted-foreground/70 mt-4">點下方文字塊組成句子</p>
          : (
            <div className="flex flex-wrap gap-2">
              {picked.map(t => (
                <button key={t.id} onClick={() => !reveal && unpickToken(t)} disabled={reveal}
                  className={cn(
                    "px-3 py-2 rounded-xl font-bold text-base transition-all",
                    reveal
                      ? (isCorrect ? "bg-green-500 text-white" : "bg-destructive text-white")
                      : "bg-primary text-primary-foreground active:scale-95"
                  )}>
                  {t.text}
                </button>
              ))}
            </div>
          )}
      </div>

      {/* 待選區 */}
      <div className="flex-1 min-h-[100px] p-4 rounded-2xl bg-muted/30">
        <div className="flex flex-wrap gap-2">
          {bank.map(t => (
            <button key={t.id} onClick={() => pickToken(t)} disabled={reveal}
              className="px-3 py-2 rounded-xl bg-background border-2 border-border font-bold text-base hover:border-primary active:scale-95 transition-all">
              {t.text}
            </button>
          ))}
        </div>
      </div>

      {/* 正解區（顯示 reveal 後）*/}
      {reveal && !isCorrect && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-1">正解</p>
          <p className="text-sm font-bold text-green-900">{correctText}</p>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-2">
        {!reveal ? (
          <>
            <Button variant="outline" onClick={() => { setBank(b => [...b, ...picked]); setPicked([]); }} disabled={picked.length === 0} className="flex-1 rounded-xl">
              <RotateCcw size={14} className="mr-1" /> 重置
            </Button>
            <Button onClick={() => setReveal(true)} disabled={!allPicked} className="flex-1 rounded-xl">
              提交
            </Button>
          </>
        ) : (
          <Button onClick={() => setPuzzleIdx(i => i + 1)} className="w-full rounded-xl">
            下一句 →
          </Button>
        )}
      </div>
    </div>
  );
}
