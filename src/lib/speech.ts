/**
 * @fileOverview 語音合成工具 (Speech Synthesizer)
 * 移植自 Swift 的 SpeechSynthesizer 類別
 */

export function speak(text: string) {
  if (typeof window === 'undefined') return;

  // 停止前一次的發音，避免重疊 (相當於 synthesizer.stopSpeaking)
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // 設定語系為日文 (ja-JP)
  utterance.lang = 'ja-JP';
  
  // 稍微放慢語速，適合語言學習者 (Swift 版設定為 0.85)
  utterance.rate = 0.85;
  
  // 音調設定為標準
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}
