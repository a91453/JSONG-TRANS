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
  source: 'server-sub' | 'server-sub-auto' | 'whisper' | 'genkit-ai' | 'cache';
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
  quizHighScore: number;
  dailyKanaCount: number;
  dailyVocabCount: number;
  lastResetDate: string;
}
