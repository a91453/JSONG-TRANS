export type KanaType = 'seion' | 'dakuon' | 'yoon';

export interface Kana {
  character: string;
  romaji: string;
  type: KanaType;
}

export interface VocabularyWord {
  word: string;
  furigana: string;
  translation: string;
  category: string;
}

export const VocabularyData = {
  words: [
    // MARK: - 打招呼 (Greetings)
    { word: "おはよう", furigana: "おはよう", translation: "早安 (輕鬆)", category: "打招呼" },
    { word: "こんにちは", furigana: "こんにちは", translation: "你好 / 午安", category: "打招呼" },
    { word: "こんばんは", furigana: "こんばんは", translation: "晚安 (見面時)", category: "打招呼" },
    { word: "おやすみなさい", furigana: "おやすみなさい", translation: "晚安 (睡前)", category: "打招呼" },
    { word: "ありがとう", furigana: "ありがとう", translation: "謝謝", category: "打招呼" },
    { word: "すみません", furigana: "すみません", translation: "不好意思 / 對不起", category: "打招呼" },
    { word: "ごめんなさい", furigana: "ごめんなさい", translation: "對不起 (較熟)", category: "打招呼" },
    { word: "さようなら", furigana: "さようなら", translation: "再見", category: "打招呼" },
    { word: "はじめまして", furigana: "はじめまして", translation: "初次見面", category: "打招呼" },
    { word: "お願いします", furigana: "おねがいします", translation: "麻煩你了 / 拜託了", category: "打招呼" },
    
    // MARK: - 數字 (Numbers)
    { word: "一", furigana: "いち", translation: "一", category: "數字" },
    { word: "二", furigana: "に", translation: "二", category: "數字" },
    { word: "三", furigana: "さん", translation: "三", category: "數字" },
    { word: "四", furigana: "よん / し", translation: "四", category: "數字" },
    { word: "五", furigana: "ご", translation: "五", category: "數字" },
    { word: "六", furigana: "ろく", translation: "六", category: "數字" },
    { word: "七", furigana: "なな / しち", translation: "七", category: "數字" },
    { word: "八", furigana: "はち", translation: "八", category: "數字" },
    { word: "九", furigana: "きゅう / く", translation: "九", category: "數字" },
    { word: "十", furigana: "じゅう", translation: "十", category: "數字" },
    { word: "百", furigana: "ひゃく", translation: "百", category: "數字" },
    { word: "千", furigana: "せん", translation: "千", category: "數字" },
    { word: "万", furigana: "まん", translation: "萬", category: "數字" },
    
    // MARK: - 日常生活 (Daily Life)
    { word: "私", furigana: "わたし", translation: "我", category: "日常生活" },
    { word: "あなた", furigana: "あなた", translation: "你", category: "日常生活" },
    { word: "友達", furigana: "ともだち", translation: "朋友", category: "日常生活" },
    { word: "家", furigana: "いえ", translation: "家 / 房子", category: "日常生活" },
    { word: "学校", furigana: "がっこう", translation: "學校", category: "日常生活" },
    { word: "車", furigana: "くるま", translation: "車子", category: "日常生活" },
    { word: "電車", furigana: "でんしゃ", translation: "電車", category: "日常生活" },
    { word: "お金", furigana: "おかね", translation: "錢", category: "日常生活" },
    { word: "時間", furigana: "じかん", translation: "時間", category: "日常生活" },
    { word: "今日", furigana: "きょう", translation: "今天", category: "日常生活" },
    { word: "明日", furigana: "あした", translation: "明天", category: "日常生活" },
    { word: "昨日", furigana: "きのう", translation: "昨天", category: "日常生活" },
    { word: "水", furigana: "みず", translation: "水", category: "日常生活" },
    { word: "本", furigana: "ほん", translation: "書本", category: "日常生活" },
    { word: "仕事", furigana: "しごと", translation: "工作", category: "日常生活" },
    
    // MARK: - 飲食 (Food & Drink)
    { word: "ご飯", furigana: "ごはん", translation: "飯 / 餐點", category: "飲食" },
    { word: "肉", furigana: "にく", translation: "肉", category: "飲食" },
    { word: "魚", furigana: "さかな", translation: "魚", category: "飲食" },
    { word: "野菜", furigana: "やさい", translation: "蔬菜", category: "飲食" },
    { word: "果物", furigana: "くだもの", translation: "水果", category: "飲食" },
    { word: "お茶", furigana: "おちゃ", translation: "茶", category: "飲食" },
    { word: "牛乳", furigana: "ぎゅうにゅう", translation: "牛奶", category: "飲食" },
    { word: "美味しい", furigana: "おいしい", translation: "好吃的", category: "飲食" },
    { word: "食べる", furigana: "たべる", translation: "吃", category: "飲食" },
    { word: "飲む", furigana: "のむ", translation: "喝", category: "飲食" },
    
    // MARK: - 動物 (Animals)
    { word: "犬", furigana: "いぬ", translation: "狗", category: "動物" },
    { word: "貓", furigana: "ねこ", translation: "貓", category: "動物" },
    { word: "鳥", furigana: "とり", translation: "鳥", category: "動物" },
    { word: "牛", furigana: "うし", translation: "牛", category: "動物" },
    { word: "馬", furigana: "うま", translation: "馬", category: "動物" },
    { word: "豚", furigana: "ぶた", translation: "豬", category: "動物" },
    { word: "熊", furigana: "くま", translation: "熊", category: "動物" },
    { word: "猿", furigana: "さる", translation: "猴子", category: "動物" },
    
    // MARK: - 動詞與形容詞 (Verbs & Adjectives)
    { word: "行く", furigana: "いく", translation: "去", category: "動詞與形容詞" },
    { word: "来る", furigana: "くる", translation: "來", category: "動詞與形容詞" },
    { word: "見る", furigana: "みる", translation: "看", category: "動詞與形容詞" },
    { word: "聞く", furigana: "きく", translation: "聽 / 問", category: "動詞與形容詞" },
    { word: "話す", furigana: "はなす", translation: "說話", category: "動詞與形容詞" },
    { word: "大きい", furigana: "おおきい", translation: "大的", category: "動詞與形容詞" },
    { word: "小さい", furigana: "ちいさい", translation: "小的", category: "動詞與形容詞" },
    { word: "新しい", furigana: "あたらしい", translation: "新的", category: "動詞與形容詞" },
    { word: "古い", furigana: "ふるい", translation: "舊的", category: "動詞與形容詞" },
    { word: "良い", furigana: "いい / よい", translation: "好的", category: "動詞與形容詞" }
  ] as VocabularyWord[]
};

export const HiraganaData = {
  basic: [
    { character: "あ", romaji: "a", type: "seion" }, { character: "い", romaji: "i", type: "seion" }, { character: "う", romaji: "u", type: "seion" }, { character: "え", romaji: "e", type: "seion" }, { character: "お", romaji: "o", type: "seion" },
    { character: "か", romaji: "ka", type: "seion" }, { character: "き", romaji: "ki", type: "seion" }, { character: "く", romaji: "ku", type: "seion" }, { character: "け", romaji: "ke", type: "seion" }, { character: "こ", romaji: "ko", type: "seion" },
    { character: "さ", romaji: "sa", type: "seion" }, { character: "し", romaji: "shi", type: "seion" }, { character: "す", romaji: "su", type: "seion" }, { character: "せ", romaji: "se", type: "seion" }, { character: "そ", romaji: "so", type: "seion" },
    { character: "た", romaji: "ta", type: "seion" }, { character: "ち", romaji: "chi", type: "seion" }, { character: "つ", romaji: "tsu", type: "seion" }, { character: "て", romaji: "te", type: "seion" }, { character: "と", romaji: "to", type: "seion" },
    { character: "な", romaji: "na", type: "seion" }, { character: "に", romaji: "ni", type: "seion" }, { character: "ぬ", romaji: "nu", type: "seion" }, { character: "ね", romaji: "ne", type: "seion" }, { character: "の", romaji: "no", type: "seion" },
    { character: "は", romaji: "ha", type: "seion" }, { character: "ひ", romaji: "hi", type: "seion" }, { character: "ふ", romaji: "fu", type: "seion" }, { character: "へ", romaji: "he", type: "seion" }, { character: "ほ", romaji: "ho", type: "seion" },
    { character: "ま", romaji: "ma", type: "seion" }, { character: "み", romaji: "mi", type: "seion" }, { character: "む", romaji: "mu", type: "seion" }, { character: "め", romaji: "me", type: "seion" }, { character: "も", romaji: "mo", type: "seion" },
    { character: "や", romaji: "ya", type: "seion" }, { character: "ゆ", romaji: "yu", type: "seion" }, { character: "よ", romaji: "yo", type: "seion" },
    { character: "ら", romaji: "ra", type: "seion" }, { character: "り", romaji: "ri", type: "seion" }, { character: "る", romaji: "ru", type: "seion" }, { character: "れ", romaji: "re", type: "seion" }, { character: "ろ", romaji: "ro", type: "seion" },
    { character: "わ", romaji: "wa", type: "seion" }, { character: "を", romaji: "wo", type: "seion" }, { character: "ん", romaji: "n", type: "seion" }
  ] as Kana[],
  dakuon: [
    { character: "が", romaji: "ga", type: "dakuon" }, { character: "ぎ", romaji: "gi", type: "dakuon" }, { character: "ぐ", romaji: "gu", type: "dakuon" }, { character: "げ", romaji: "ge", type: "dakuon" }, { character: "ご", romaji: "go", type: "dakuon" },
    { character: "ざ", romaji: "za", type: "dakuon" }, { character: "じ", romaji: "ji", type: "dakuon" }, { character: "ず", romaji: "zu", type: "dakuon" }, { character: "ぜ", romaji: "ze", type: "dakuon" }, { character: "ぞ", romaji: "zo", type: "dakuon" },
    { character: "だ", romaji: "da", type: "dakuon" }, { character: "ぢ", romaji: "ji", type: "dakuon" }, { character: "づ", romaji: "zu", type: "dakuon" }, { character: "で", romaji: "de", type: "dakuon" }, { character: "ど", romaji: "do", type: "dakuon" },
    { character: "ば", romaji: "ba", type: "dakuon" }, { character: "び", romaji: "bi", type: "dakuon" }, { character: "ぶ", romaji: "bu", type: "dakuon" }, { character: "べ", romaji: "be", type: "dakuon" }, { character: "ぼ", romaji: "bo", type: "dakuon" },
    { character: "ぱ", romaji: "pa", type: "dakuon" }, { character: "ぴ", romaji: "pi", type: "dakuon" }, { character: "ぷ", romaji: "pu", type: "dakuon" }, { character: "ぺ", romaji: "pe", type: "dakuon" }, { character: "ぽ", romaji: "po", type: "dakuon" }
  ] as Kana[],
  yoon: [
    { character: "きゃ", romaji: "kya", type: "yoon" }, { character: "きゅ", romaji: "kyu", type: "yoon" }, { character: "きょ", romaji: "kyo", type: "yoon" },
    { character: "しゃ", romaji: "sha", type: "yoon" }, { character: "しゅ", romaji: "shu", type: "yoon" }, { character: "しょ", romaji: "sho", type: "yoon" },
    { character: "ちゃ", romaji: "cha", type: "yoon" }, { character: "ちゅ", romaji: "chu", type: "yoon" }, { character: "ちょ", romaji: "cho", type: "yoon" },
    { character: "にゃ", romaji: "nya", type: "yoon" }, { character: "にゅ", romaji: "nyu", type: "yoon" }, { character: "にょ", romaji: "nyo", type: "yoon" },
    { character: "ひゃ", romaji: "hya", type: "yoon" }, { character: "ひゅ", romaji: "hyu", type: "yoon" }, { character: "ひょ", romaji: "hyo", type: "yoon" },
    { character: "みゃ", romaji: "mya", type: "yoon" }, { character: "みゅ", romaji: "myu", type: "yoon" }, { character: "みょ", romaji: "myo", type: "yoon" },
    { character: "りゃ", romaji: "rya", type: "yoon" }, { character: "りゅ", romaji: "ryu", type: "yoon" }, { character: "りょ", romaji: "ryo", type: "yoon" },
    { character: "ぎゃ", romaji: "gya", type: "yoon" }, { character: "ぎゅ", romaji: "gyu", type: "yoon" }, { character: "ぎょ", romaji: "gyo", type: "yoon" },
    { character: "じゃ", romaji: "ja", type: "yoon" }, { character: "じゅ", romaji: "ju", type: "yoon" }, { character: "じょ", romaji: "jo", type: "yoon" },
    { character: "びゃ", romaji: "bya", type: "yoon" }, { character: "びゅ", romaji: "byu", type: "yoon" }, { character: "びょ", romaji: "byo", type: "yoon" },
    { character: "ぴゃ", romaji: "pya", type: "yoon" }, { character: "ぴゅ", romaji: "pyu", type: "yoon" }, { character: "ぴょ", romaji: "pyo", type: "yoon" }
  ] as Kana[]
};

export const KatakanaData = {
  basic: [
    { character: "ア", romaji: "a", type: "seion" }, { character: "イ", romaji: "i", type: "seion" }, { character: "ウ", romaji: "u", type: "seion" }, { character: "エ", romaji: "e", type: "seion" }, { character: "オ", romaji: "o", type: "seion" },
    { character: "カ", romaji: "ka", type: "seion" }, { character: "キ", romaji: "ki", type: "seion" }, { character: "ク", romaji: "ku", type: "seion" }, { character: "ケ", romaji: "ke", type: "seion" }, { character: "コ", romaji: "ko", type: "seion" },
    { character: "サ", romaji: "sa", type: "seion" }, { character: "シ", romaji: "shi", type: "seion" }, { character: "ス", romaji: "su", type: "seion" }, { character: "セ", romaji: "se", type: "seion" }, { character: "ソ", romaji: "so", type: "seion" },
    { character: "タ", romaji: "ta", type: "seion" }, { character: "チ", romaji: "chi", type: "seion" }, { character: "ツ", romaji: "tsu", type: "seion" }, { character: "テ", romaji: "te", type: "seion" }, { character: "ト", romaji: "to", type: "seion" },
    { character: "ナ", romaji: "na", type: "seion" }, { character: "ニ", romaji: "ni", type: "seion" }, { character: "ヌ", romaji: "nu", type: "seion" }, { character: "ネ", romaji: "ne", type: "seion" }, { character: "ノ", romaji: "no", type: "seion" },
    { character: "ハ", romaji: "ha", type: "seion" }, { character: "ヒ", romaji: "hi", type: "seion" }, { character: "フ", romaji: "fu", type: "seion" }, { character: "ヘ", romaji: "he", type: "seion" }, { character: "ホ", romaji: "ho", type: "seion" },
    { character: "マ", romaji: "ma", type: "seion" }, { character: "ミ", romaji: "mi", type: "seion" }, { character: "ム", romaji: "mu", type: "seion" }, { character: "メ", romaji: "me", type: "seion" }, { character: "モ", romaji: "mo", type: "seion" },
    { character: "ヤ", romaji: "ya", type: "seion" }, { character: "ユ", romaji: "yu", type: "seion" }, { character: "ヨ", romaji: "yo", type: "seion" },
    { character: "ラ", romaji: "ra", type: "seion" }, { character: "リ", romaji: "ri", type: "seion" }, { character: "ル", romaji: "ru", type: "seion" }, { character: "レ", romaji: "re", type: "seion" }, { character: "ロ", romaji: "ro", type: "seion" },
    { character: "ワ", romaji: "wa", type: "seion" }, { character: "ヲ", romaji: "wo", type: "seion" }, { character: "ン", romaji: "n", type: "seion" }
  ] as Kana[],
  dakuon: [
    { character: "ガ", romaji: "ga", type: "dakuon" }, { character: "ギ", romaji: "gi", type: "dakuon" }, { character: "グ", romaji: "gu", type: "dakuon" }, { character: "ゲ", romaji: "ge", type: "dakuon" }, { character: "ゴ", romaji: "go", type: "dakuon" },
    { character: "ザ", romaji: "za", type: "dakuon" }, { character: "ジ", romaji: "ji", type: "dakuon" }, { character: "ズ", romaji: "zu", type: "dakuon" }, { character: "ぜ", romaji: "ze", type: "dakuon" }, { character: "ゾ", romaji: "zo", type: "dakuon" },
    { character: "ダ", romaji: "da", type: "dakuon" }, { character: "ヂ", romaji: "ji", type: "dakuon" }, { character: "ヅ", romaji: "zu", type: "dakuon" }, { character: "デ", romaji: "de", type: "dakuon" }, { character: "ド", romaji: "do", type: "dakuon" },
    { character: "バ", romaji: "ba", type: "dakuon" }, { character: "ビ", romaji: "bi", type: "dakuon" }, { character: "ブ", romaji: "bu", type: "dakuon" }, { character: "ベ", romaji: "be", type: "dakuon" }, { character: "ボ", romaji: "bo", type: "dakuon" },
    { character: "パ", romaji: "pa", type: "dakuon" }, { character: "ピ", romaji: "pi", type: "dakuon" }, { character: "ぷ", romaji: "pu", type: "dakuon" }, { character: "ペ", romaji: "pe", type: "dakuon" }, { character: "ポ", romaji: "po", type: "dakuon" }
  ] as Kana[],
  yoon: [
    { character: "キャ", romaji: "kya", type: "yoon" }, { character: "キュ", romaji: "kyu", type: "yoon" }, { character: "キョ", romaji: "kyo", type: "yoon" },
    { character: "シャ", romaji: "sha", type: "yoon" }, { character: "シュ", romaji: "shu", type: "yoon" }, { character: "ショ", romaji: "sho", type: "yoon" },
    { character: "チャ", romaji: "cha", type: "yoon" }, { character: "チュ", romaji: "chu", type: "yoon" }, { character: "チョ", romaji: "cho", type: "yoon" },
    { character: "ニャ", romaji: "nya", type: "yoon" }, { character: "ニュ", romaji: "nyu", type: "yoon" }, { character: "ニョ", romaji: "nyo", type: "yoon" },
    { character: "ヒャ", romaji: "hya", type: "yoon" }, { character: "ヒュ", romaji: "hyu", type: "yoon" }, { character: "ヒョ", romaji: "hyo", type: "yoon" },
    { character: "ミャ", romaji: "mya", type: "yoon" }, { character: "ミュ", romaji: "myu", type: "yoon" }, { character: "ミョ", romaji: "myo", type: "yoon" },
    { character: "リャ", romaji: "rya", type: "yoon" }, { character: "リュ", romaji: "ryu", type: "yoon" }, { character: "リョ", romaji: "ryo", type: "yoon" },
    { character: "ギャ", romaji: "gya", type: "yoon" }, { character: "ギュ", romaji: "gyu", type: "yoon" }, { character: "ギョ", romaji: "gyo", type: "yoon" },
    { character: "ジャ", romaji: "ja", type: "yoon" }, { character: "ジュ", romaji: "ju", type: "yoon" }, { character: "ジョ", romaji: "jo", type: "yoon" },
    { character: "ビャ", romaji: "bya", type: "yoon" }, { character: "ビュ", romaji: "byu", type: "yoon" }, { character: "ビョ", romaji: "byo", type: "yoon" },
    { character: "ピャ", romaji: "pya", type: "yoon" }, { character: "ピュ", romaji: "pyu", type: "yoon" }, { character: "ピョ", romaji: "pyo", type: "yoon" }
  ] as Kana[]
};

export const HiraganaAll = [...HiraganaData.basic, ...HiraganaData.dakuon, ...HiraganaData.yoon];
export const KatakanaAll = [...KatakanaData.basic, ...KatakanaData.dakuon, ...KatakanaData.yoon];

(HiraganaData as any).all = HiraganaAll;
(KatakanaData as any).all = KatakanaAll;
