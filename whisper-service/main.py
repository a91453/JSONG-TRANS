"""
Whisper 語音聽寫微服務 — Google Cloud Run

流程：
  1. Next.js 呼叫 /api/transcribe?v={videoId}
  2. 以 yt-dlp 下載 YouTube 音頻（m4a）
  3. 送至 Groq Whisper API 進行日文轉錄
  4. 回傳帶時間軸的段落給 Next.js

環境變數（在 Cloud Run 或 .env 中設定）：
  GROQ_API_KEY       — Groq API Key（服務方自備，使用者無需設定）
  SERVICE_SECRET     — 與 Next.js SUBTITLE_SERVICE_SECRET 一致，防止濫用
  WHISPER_MODEL      — 可選，預設 whisper-large-v3-turbo
  YT_DLP_PROXY       — 可選，代理伺服器（若 GCP IP 被 YouTube 封鎖時使用）
  YT_DLP_COOKIES_FILE — 可選，cookies.txt 路徑（繞過年齡限制或封鎖）
"""

import os
import glob
import logging
import tempfile

import requests
import yt_dlp
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

GROQ_API_KEY    = os.environ.get("GROQ_API_KEY", "")
SERVICE_SECRET  = os.environ.get("SERVICE_SECRET", "")
WHISPER_MODEL   = os.environ.get("WHISPER_MODEL", "whisper-large-v3-turbo")
YT_DLP_PROXY    = os.environ.get("YT_DLP_PROXY", "")
COOKIES_FILE    = os.environ.get("YT_DLP_COOKIES_FILE", "")

MAX_AUDIO_MB    = 24          # Groq 上限 25 MB，預留 1 MB 緩衝
TIMEOUT_GROQ    = 120         # seconds
TIMEOUT_YTDLP   = 180         # seconds


# ── 健康檢查 ──────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": WHISPER_MODEL})


# ── 主要轉錄端點 ──────────────────────────────────────────────────────────────

@app.route("/api/transcribe")
def transcribe():
    # ── 驗證請求來源 ─────────────────────────────────────────────────────
    if SERVICE_SECRET and request.headers.get("X-Service-Secret") != SERVICE_SECRET:
        return jsonify({"error": "unauthorized"}), 401

    video_id = request.args.get("v", "").strip()
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "invalid video id"}), 400

    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not configured"}), 500

    log.info(f"[{video_id}] 開始處理")

    # ── 1. yt-dlp 下載音頻 ────────────────────────────────────────────────
    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = os.path.join(tmpdir, f"{video_id}.%(ext)s")

        ydl_opts: dict = {
            # 優先抓 128kbps 以內的 m4a，縮短下載時間
            "format": "bestaudio[ext=m4a][abr<=128]/bestaudio[ext=webm][abr<=128]/bestaudio",
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": TIMEOUT_YTDLP,
            # 轉換為 m4a，壓低 bitrate 減少檔案大小
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "m4a",
                "preferredquality": "64",   # kbps — 64 kbps 對 Whisper 已足夠
            }],
        }

        if YT_DLP_PROXY:
            ydl_opts["proxy"] = YT_DLP_PROXY
            log.info(f"[{video_id}] 使用代理: {YT_DLP_PROXY}")

        if COOKIES_FILE and os.path.isfile(COOKIES_FILE):
            ydl_opts["cookiefile"] = COOKIES_FILE

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={video_id}",
                    download=True
                )
                duration = info.get("duration", 0)
                log.info(f"[{video_id}] 音頻下載完成，時長: {duration:.0f}s")
        except yt_dlp.utils.DownloadError as e:
            log.error(f"[{video_id}] yt-dlp 錯誤: {e}")
            return jsonify({"error": f"yt-dlp: {str(e)[:200]}"}), 502

        # ── 找到實際輸出檔案 ───────────────────────────────────────────
        audio_files = glob.glob(os.path.join(tmpdir, f"{video_id}.*"))
        if not audio_files:
            return jsonify({"error": "audio file not found after download"}), 500

        audio_path = audio_files[0]
        file_size_mb = os.path.getsize(audio_path) / 1024 / 1024
        log.info(f"[{video_id}] 音頻大小: {file_size_mb:.1f} MB")

        if file_size_mb > MAX_AUDIO_MB:
            return jsonify({"error": f"audio too large ({file_size_mb:.1f} MB > {MAX_AUDIO_MB} MB limit)"}), 413

        # ── 2. Groq Whisper 轉錄 ──────────────────────────────────────
        ext = audio_path.rsplit(".", 1)[-1].lower()
        mime = {"m4a": "audio/mp4", "webm": "audio/webm", "mp3": "audio/mpeg",
                "ogg": "audio/ogg", "opus": "audio/ogg"}.get(ext, "audio/mpeg")

        try:
            with open(audio_path, "rb") as f:
                groq_resp = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    files={"file": (f"{video_id}.{ext}", f, mime)},
                    data={
                        "model": WHISPER_MODEL,
                        "response_format": "verbose_json",
                        "language": "ja",
                        "timestamp_granularities[]": "segment",
                    },
                    timeout=TIMEOUT_GROQ,
                )
        except requests.Timeout:
            return jsonify({"error": "Groq Whisper timeout"}), 504

        if not groq_resp.ok:
            log.error(f"[{video_id}] Groq 錯誤: {groq_resp.status_code} {groq_resp.text[:200]}")
            return jsonify({"error": f"Groq {groq_resp.status_code}: {groq_resp.text[:200]}"}), 502

        data = groq_resp.json()
        segments = [
            {
                "start": round(float(s["start"]), 2),
                "end":   round(float(s["end"]), 2),
                "text":  s["text"].strip(),
            }
            for s in data.get("segments", [])
            if s.get("text", "").strip()
        ]

        log.info(f"[{video_id}] 轉錄完成：{len(segments)} 段")
        return jsonify({"segments": segments, "model": WHISPER_MODEL})


# ── 本地開發入口 ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
