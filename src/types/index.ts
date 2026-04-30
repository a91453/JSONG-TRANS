export type KanaType = 'seion' | 'dakuon' | 'yoon';

export interface FuriganaItem {
  word: string;
  reading: string;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  japanese: string;
  furigana: FuriganaItem[];
  translation: string;
}

export interface AnalyzeResponse {
  videoId: string;
  duration: number;
  segments: Segment[];
  source: 'youtube-official' | 'youtube-auto' | 'external' | 'manual' | 'whisper-groq' | 'genkit-ai' | 'cache' | 'lrclib' | 'server-sub' | 'server-sub-auto';
}

export interface YouTubeVideoInfo {
  title: string;
  author: string;
}

export interface VideoHistoryMeta {
  id: string;
  videoId: string;
  songTitle: string;
  artistName: string;
  analyzedDate: string; // ISO String
  duration: number;
  segmentCount: number;
}

export interface WordSource {
  id: string;
  videoId: string;
  songTitle: string;
  sentence: string;
  translation: string;
}

export interface DictEntry {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  sources: WordSource[];
  addedDate: string; // ISO String
  mastered: boolean;
  /** AI 補全的單字級翻譯（可空字串，由使用者按「補全字義」批次取得） */
  wordTranslation?: string;
  /** 最近一次看到 / 練習這個字的 ISO 時間，供 SRS 排序：越久未見越優先 */
  lastSeenAt?: string;
}

export interface FavoriteSegment {
  id: string;
  videoId: string;
  songTitle: string;
  artistName: string;
  start: number;
  end: number;
  japanese: string;
  translation: string;
  addedDate: string; // ISO String
}

export interface StreakData {
  lastDate: string;
  current: number;
  longest: number;
  total: number;
}

export interface ProgressData {
  learnedKanaCount: number;
  learnedVocabularyCount: number;
  /** 綜合詞庫測驗最高分（題目來自 VocabularyData） */
  quizHighScore: number;
  /** 我的字典測驗最高分（題目來自使用者收藏） */
  quizDictHighScore: number;
  dailyKanaCount: number;
  dailyVocabCount: number;
  lastResetDate: string;
}
