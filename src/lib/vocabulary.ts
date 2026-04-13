
export interface VocabItem {
  id: string;
  kanji: string;
  reading: string;
  meaning: string;
  furigana: string;
}

export const HIRAGANA = [
  { char: 'あ', romaji: 'a' }, { char: 'い', romaji: 'i' }, { char: 'う', romaji: 'u' }, { char: 'え', romaji: 'e' }, { char: 'お', romaji: 'o' },
  { char: 'か', romaji: 'ka' }, { char: 'き', romaji: 'ki' }, { char: 'く', romaji: 'ku' }, { char: 'け', romaji: 'ke' }, { char: 'こ', romaji: 'ko' },
  { char: 'さ', romaji: 'sa' }, { char: 'し', romaji: 'shi' }, { char: 'す', romaji: 'su' }, { char: 'せ', romaji: 'se' }, { char: 'そ', romaji: 'so' },
  { char: 'た', romaji: 'ta' }, { char: 'ち', romaji: 'chi' }, { char: 'つ', romaji: 'tsu' }, { char: 'て', romaji: 'te' }, { char: 'と', romaji: 'to' },
  { char: 'な', romaji: 'na' }, { char: 'に', romaji: 'ni' }, { char: 'ぬ', romaji: 'nu' }, { char: 'ね', romaji: 'ne' }, { char: 'の', romaji: 'no' },
  { char: 'は', romaji: 'ha' }, { char: 'ひ', romaji: 'hi' }, { char: 'ふ', romaji: 'fu' }, { char: 'へ', romaji: 'he' }, { char: 'ほ', romaji: 'ho' },
  { char: 'ま', romaji: 'ma' }, { char: 'み', romaji: 'mi' }, { char: 'む', romaji: 'mu' }, { char: 'め', romaji: 'me' }, { char: 'も', romaji: 'mo' },
  { char: 'や', romaji: 'ya' }, { char: 'ゆ', romaji: 'yu' }, { char: 'よ', romaji: 'yo' },
  { char: 'ら', romaji: 'ra' }, { char: 'り', romaji: 'ri' }, { char: 'る', romaji: 'ru' }, { char: 'れ', romaji: 're' }, { char: 'ろ', romaji: 'ro' },
  { char: 'わ', romaji: 'wa' }, { char: 'を', romaji: 'wo' }, { char: 'ん', romaji: 'n' },
];

export const VOCAB_BANK: VocabItem[] = [
  { id: '1', kanji: '先生', reading: 'せんせい', meaning: 'Teacher', furigana: 'せんせい' },
  { id: '2', kanji: '学生', reading: 'がくせい', meaning: 'Student', furigana: 'がくせい' },
  { id: '3', kanji: '学校', reading: 'がっこう', meaning: 'School', furigana: 'がっこう' },
  { id: '4', kanji: '日本語', reading: 'にほんご', meaning: 'Japanese Language', furigana: 'にほんご' },
  { id: '5', kanji: '勉強', reading: 'べんきょう', meaning: 'Study', furigana: 'べんきょう' },
  { id: '6', kanji: '友達', reading: 'ともだち', meaning: 'Friend', furigana: 'ともだち' },
  { id: '7', kanji: '本', reading: 'ほん', meaning: 'Book', furigana: 'ほん' },
  { id: '8', kanji: '車', reading: 'くるま', meaning: 'Car', furigana: 'くるま' },
  { id: '9', kanji: '水', reading: 'みず', meaning: 'Water', furigana: 'みず' },
  { id: '10', kanji: '猫', reading: 'ねこ', meaning: 'Cat', furigana: 'ねこ' },
  { id: '11', kanji: '犬', reading: 'いぬ', meaning: 'Dog', furigana: 'いぬ' },
  { id: '12', kanji: '家族', reading: 'かぞく', meaning: 'Family', furigana: 'かぞく' },
];

export const LESSON_SUBTITLES = [
  { start: 0, end: 3, jp: 'こんにちは、皆さん。', furigana: 'こんにちは、みなさん。', en: 'Hello, everyone.' },
  { start: 3, end: 7, jp: '今日は日本語を勉強しましょう。', furigana: 'きょうはにほんごをべんきょうしましょう。', en: 'Let\'s study Japanese today.' },
  { start: 7, end: 12, jp: 'まずは基本的な挨拶からです。', furigana: 'まずはきほんてきなあいさつからです。', en: 'First, let\'s start with basic greetings.' },
];
