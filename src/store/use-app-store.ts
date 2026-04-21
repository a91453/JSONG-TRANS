
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  DictEntry, 
  VideoHistoryMeta, 
  AnalyzeResponse, 
  FavoriteSegment, 
  StreakData,
  Segment,
  ProgressData,
  WordSource
} from '@/types';
import { convertToRomaji } from '@/lib/romaji-utils';

// --- Settings Store ---
interface SettingsState {
  themeMode: 'system' | 'light' | 'dark';
  lyricsFontSize: number;
  defaultAnnotation: 'furigana' | 'romaji' | 'both' | 'none';
  loopCount: number;
  autoPlayOnTap: boolean;
  showTranslation: boolean;
  // AI Settings
  aiProvider: 'google' | 'groq';
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  // Cloud Run 轉錄服務（使用者自備資源）
  cloudRunGroqApiKey: string;
  cloudRunCookieContent: string;
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void;
  setLyricsFontSize: (size: number) => void;
  setDefaultAnnotation: (mode: 'furigana' | 'romaji' | 'both' | 'none') => void;
  setLoopCount: (count: number) => void;
  setAutoPlayOnTap: (enabled: boolean) => void;
  setShowTranslation: (enabled: boolean) => void;
  setAiProvider: (provider: 'google' | 'groq') => void;
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  setGroqApiKey: (key: string) => void;
  setGroqModel: (model: string) => void;
  setCloudRunGroqApiKey: (key: string) => void;
  setCloudRunCookieContent: (content: string) => void;
  resetApiKeys: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      lyricsFontSize: 15,
      defaultAnnotation: 'furigana',
      loopCount: 3,
      autoPlayOnTap: true,
      showTranslation: true,
      aiProvider: 'google',
      geminiApiKey: '',
      geminiModel: 'googleai/gemini-2.5-flash',
      groqApiKey: '',
      groqModel: 'openai/llama-3.3-70b-versatile', // mixtral-8x7b-32768 已於 2025 年下架
      cloudRunGroqApiKey: '',
      cloudRunCookieContent: '',
      setThemeMode: (themeMode) => set({ themeMode }),
      setLyricsFontSize: (lyricsFontSize) => set({ lyricsFontSize }),
      setDefaultAnnotation: (defaultAnnotation) => set({ defaultAnnotation }),
      setLoopCount: (loopCount) => set({ loopCount }),
      setAutoPlayOnTap: (autoPlayOnTap) => set({ autoPlayOnTap }),
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setGeminiModel: (geminiModel) => set({ geminiModel }),
      setGroqApiKey: (groqApiKey) => set({ groqApiKey }),
      setGroqModel: (groqModel) => set({ groqModel }),
      setCloudRunGroqApiKey: (cloudRunGroqApiKey) => set({ cloudRunGroqApiKey }),
      setCloudRunCookieContent: (cloudRunCookieContent) => set({ cloudRunCookieContent }),
      resetApiKeys: () => set({ geminiApiKey: '', groqApiKey: '', cloudRunGroqApiKey: '', cloudRunCookieContent: '' }),
    }),
    { name: 'nihongo-settings-storage-v5' }
  )
);

// --- Dictionary Store ---
interface DictionaryState {
  entries: DictEntry[];
  addEntry: (word: string, reading: string, videoId: string, songTitle: string, sentence: string, translation: string) => void;
  addAllFromSegment: (segment: Segment, videoId: string, songTitle: string) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  toggleMastered: (id: string) => void;
  contains: (word: string, reading: string) => boolean;
  countForSong: (videoId: string) => number;
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (word, reading, videoId, songTitle, sentence, translation) => {
        const { entries } = get();
        const existingIdx = entries.findIndex(e => e.word === word && e.reading === reading);
        const source: WordSource = { id: crypto.randomUUID(), videoId, songTitle, sentence, translation };

        if (existingIdx !== -1) {
          const updated = [...entries];
          const entry = updated[existingIdx];
          if (!entry.sources.some(s => s.videoId === videoId && s.sentence === sentence)) {
            entry.sources.push(source);
            set({ entries: updated });
          }
          return;
        }

        const newEntry: DictEntry = {
          id: crypto.randomUUID(),
          word,
          reading,
          romaji: convertToRomaji(reading),
          sources: [source],
          addedDate: new Date().toISOString(),
          mastered: false
        };
        set({ entries: [newEntry, ...entries] });
      },
      addAllFromSegment: (segment, videoId, songTitle) => {
        segment.furigana.forEach(item => {
          get().addEntry(item.word, item.reading, videoId, songTitle, segment.japanese, segment.translation);
        });
      },
      removeEntry: (id) => set(state => ({
        entries: state.entries.filter(e => e.id !== id),
      })),
      clearAll: () => set({ entries: [] }),
      toggleMastered: (id) => set(state => ({
        entries: state.entries.map(e => e.id === id ? { ...e, mastered: !e.mastered } : e),
      })),
      contains: (word, reading) => get().entries.some(e => e.word === word && e.reading === reading),
      countForSong: (videoId) => get().entries.filter(e => e.sources.some(s => s.videoId === videoId)).length,
    }),
    { name: 'nihongo-dictionary-storage-v3' }
  )
);

// --- History Store ---
interface HistoryState {
  items: VideoHistoryMeta[];
  results: Record<string, AnalyzeResponse>;
  saveResult: (response: AnalyzeResponse, title: string, artist: string) => void;
  removeByVideoId: (videoId: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      results: {},
      saveResult: (response, title, artist) => set(state => {
        const videoId  = response.videoId;
        const existing = state.results[videoId];
        // 若現有結果比新結果更完整（更多段落），拒絕覆蓋（防止失敗結果覆蓋成功結果）
        // forceRefresh 路徑會先呼叫 removeByVideoId，使 existing 為 undefined，故不受影響
        if (existing && existing.segments.length > response.segments.length) {
          return state;
        }
        const newMeta: VideoHistoryMeta = {
          id: crypto.randomUUID(),
          videoId,
          songTitle: title,
          artistName: artist,
          analyzedDate: new Date().toISOString(),
          duration: response.duration,
          segmentCount: response.segments.length
        };
        const filteredItems = state.items.filter(i => i.videoId !== videoId);
        return {
          items: [newMeta, ...filteredItems],
          results: { ...state.results, [videoId]: response }
        };
      }),
      removeByVideoId: (videoId) => set(state => {
        const newResults = { ...state.results };
        delete newResults[videoId];
        return {
          items: state.items.filter(i => i.videoId !== videoId),
          results: newResults
        };
      }),
      clearAll: () => set({ items: [], results: {} })
    }),
    { name: 'nihongo-history-storage-v3' }
  )
);

// --- Study Streak Store ---
interface StreakState {
  streak: StreakData;
  checkIn: () => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      streak: { lastDate: '', current: 0, longest: 0, total: 0 },
      checkIn: () => {
        const today = new Date().toISOString().split('T')[0];
        const { streak } = get();
        if (streak.lastDate === today) return;

        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        const isConsecutive = streak.lastDate === yesterday;
        const newCurrent = isConsecutive ? streak.current + 1 : 1;
        
        set({
          streak: {
            lastDate: today,
            current: newCurrent,
            longest: Math.max(streak.longest, newCurrent),
            total: streak.total + 1
          }
        });
      }
    }),
    { name: 'nihongo-streak-storage-v3' }
  )
);

// --- Favorite Store ---
interface FavoriteState {
  items: FavoriteSegment[];
  addFavorite: (segment: Segment, videoId: string, songTitle: string, artistName: string) => void;
  removeFavorite: (id: string) => void;
  isFavorited: (videoId: string, start: number) => boolean;
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      items: [],
      addFavorite: (segment, videoId, songTitle, artistName) => {
        if (get().isFavorited(videoId, segment.start)) return;
        const newItem: FavoriteSegment = {
          id: crypto.randomUUID(),
          videoId,
          songTitle,
          artistName,
          start: segment.start,
          end: segment.end,
          japanese: segment.japanese,
          translation: segment.translation,
          addedDate: new Date().toISOString()
        };
        set(state => ({ items: [newItem, ...state.items] }));
      },
      removeFavorite: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),
      isFavorited: (videoId, start) => get().items.some(i => i.videoId === videoId && i.start === start)
    }),
    { name: 'nihongo-favorite-storage-v3' }
  )
);

// --- Progress Store ---
interface ProgressState {
  progress: ProgressData;
  addKana: () => void;
  addVocab: () => void;
  updateHighScore: (score: number) => void;
  checkDailyReset: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: {
        learnedKanaCount: 0,
        learnedVocabularyCount: 0,
        quizHighScore: 0,
        dailyKanaCount: 0,
        dailyVocabCount: 0,
        lastResetDate: ''
      },
      checkDailyReset: () => {
        const today = new Date().toISOString().split('T')[0];
        const { progress } = get();
        if (progress.lastResetDate !== today) {
          set({ progress: { ...progress, dailyKanaCount: 0, dailyVocabCount: 0, lastResetDate: today } });
        }
      },
      addKana: () => set(state => {
        const today = new Date().toISOString().split('T')[0];
        const isNewDay = state.progress.lastResetDate !== today;
        return { progress: { 
          ...state.progress, 
          learnedKanaCount: state.progress.learnedKanaCount + 1,
          dailyKanaCount: isNewDay ? 1 : state.progress.dailyKanaCount + 1,
          lastResetDate: today
        } };
      }),
      addVocab: () => set(state => {
        const today = new Date().toISOString().split('T')[0];
        const isNewDay = state.progress.lastResetDate !== today;
        return { progress: { 
          ...state.progress, 
          learnedVocabularyCount: state.progress.learnedVocabularyCount + 1,
          dailyVocabCount: isNewDay ? 1 : state.progress.dailyVocabCount + 1,
          lastResetDate: today
        } };
      }),
      updateHighScore: (score) => set(state => ({
        progress: { ...state.progress, quizHighScore: Math.max(state.progress.quizHighScore, score) }
      }))
    }),
    { name: 'nihongo-progress-storage-v3' }
  )
);
