
'use server';

/**
 * @fileOverview Groq Whisper 語音聽寫
 *
 * 流程：
 *   1. 透過 YouTube InnerTube API（Android client）取得無加密的音頻直連 URL
 *   2. 下載音頻緩衝區
 *   3. 上傳至 Groq Whisper API，取得帶時間軸的日文逐字稿
 *
 * 任一步驟失敗均回傳 null（主流程應降級至 AI 完整生成）。
 */

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * 透過 YouTube InnerTube（Android client）取得音頻直連 URL。
 * Android client 通常回傳未加密的 streamingData URL，不需 JS 解密。
 */
async function fetchYouTubeAudioUrl(
  videoId: string
): Promise<{ url: string; mimeType: string; sizeBytes: number } | null> {
  const body = {
    videoId,
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '17.31.35',
        androidSdkVersion: 30,
        hl: 'ja',
        gl: 'JP',
      },
      user: { lockedSafetyMode: false },
    },
  };

  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '17.31.35',
          'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.playabilityStatus?.status !== 'OK') {
      console.log('[Whisper] 影片不可播放:', data.playabilityStatus?.reason);
      return null;
    }

    const formats: any[] = data.streamingData?.adaptiveFormats ?? [];

    // 只取有直連 URL 的音頻格式（排除需要 signatureCipher 解密的格式）
    const audioFormats = formats.filter(
      (f) => f.url && f.mimeType?.startsWith('audio/')
    );

    if (audioFormats.length === 0) {
      console.log('[Whisper] 無可用的直連音頻格式（可能需要簽名解密）');
      return null;
    }

    // 優先 m4a（兼容性好），其次 webm/opus
    const m4a = audioFormats.find((f) => f.mimeType?.includes('mp4'));
    const chosen = m4a ?? audioFormats[0];

    return {
      url: chosen.url,
      mimeType: (chosen.mimeType as string).split(';')[0].trim(),
      sizeBytes: parseInt(chosen.contentLength ?? '0') || 0,
    };
  } catch (e) {
    console.log('[Whisper] InnerTube 請求失敗:', e);
    return null;
  }
}

/**
 * 下載 YouTube 影片音頻並透過 Groq Whisper 轉錄日文歌詞。
 *
 * @param videoId - YouTube 11 位影片 ID
 * @param groqApiKey - Groq API Key
 * @param model - Whisper 模型，預設 whisper-large-v3-turbo（速度快、品質佳）
 * @returns 帶時間軸的日文段落，或 null（表示失敗，主流程應降級）
 */
export async function transcribeYouTubeWithWhisper(
  videoId: string,
  groqApiKey: string,
  model = 'whisper-large-v3-turbo'
): Promise<WhisperSegment[] | null> {
  // ── 步驟 1：取得音頻 URL ──────────────────────────────────────────────
  const audioInfo = await fetchYouTubeAudioUrl(videoId);
  if (!audioInfo) return null;

  // 拒絕超過 20MB 的音頻（Groq 上限 25MB，預留緩衝）
  if (audioInfo.sizeBytes > 0 && audioInfo.sizeBytes > 20 * 1024 * 1024) {
    console.log('[Whisper] 音頻過大，跳過:', audioInfo.sizeBytes);
    return null;
  }

  // ── 步驟 2：下載音頻 ──────────────────────────────────────────────────
  let audioBuffer: ArrayBuffer;
  try {
    const audioRes = await fetch(audioInfo.url, {
      signal: AbortSignal.timeout(30000),
    });
    if (!audioRes.ok) {
      console.log('[Whisper] 音頻下載失敗:', audioRes.status);
      return null;
    }
    audioBuffer = await audioRes.arrayBuffer();
    console.log(`[Whisper] 音頻下載完成: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
  } catch (e) {
    console.log('[Whisper] 音頻下載逾時或失敗:', e);
    return null;
  }

  // ── 步驟 3：送至 Groq Whisper ─────────────────────────────────────────
  const ext = audioInfo.mimeType.includes('webm') ? 'webm'
    : audioInfo.mimeType.includes('mp4') ? 'm4a'
    : 'mp3';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: audioInfo.mimeType }), `audio.${ext}`);
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('language', 'ja');
  form.append('timestamp_granularities[]', 'segment');

  try {
    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => '');
      console.error('[Whisper] Groq 錯誤:', whisperRes.status, errBody.slice(0, 300));
      return null;
    }

    const data = await whisperRes.json();
    const segs: any[] = data.segments ?? [];

    if (segs.length < 3) {
      console.log('[Whisper] 段落數不足，可能不是日文或無語音');
      return null;
    }

    const result: WhisperSegment[] = segs
      .map((s: any) => ({
        start: Number(s.start),
        end: Number(s.end),
        text: (s.text as string).trim(),
      }))
      .filter((s) => s.text.length > 0);

    console.log(`[Whisper] 轉錄完成：${result.length} 段`);
    return result;
  } catch (e) {
    console.log('[Whisper] 轉錄請求失敗:', e);
    return null;
  }
}
