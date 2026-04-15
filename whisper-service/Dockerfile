# ── Stage 1: 安裝 Python 依賴 ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# ── Stage 2: 最終映像檔 ───────────────────────────────────────────────────────
FROM python:3.11-slim

# ffmpeg：yt-dlp 需要它來轉換音頻格式
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 從 builder 複製已安裝的 Python 套件
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY main.py .

# Cloud Run 會透過 PORT 環境變數注入埠號（預設 8080）
ENV PORT=8080
EXPOSE 8080

# gunicorn：
#   --workers 1       Cloud Run 建議單 worker（多執行緒並發）
#   --threads 4       同時處理 4 個請求（但音頻轉錄 CPU 密集，實際上 1 個就夠）
#   --timeout 300     5 分鐘逾時，足夠長影片下載 + 轉錄
#   --worker-class gthread  使用執行緒 worker 支援並發
CMD exec gunicorn \
    --bind "0.0.0.0:${PORT}" \
    --workers 1 \
    --threads 4 \
    --timeout 300 \
    --worker-class gthread \
    --access-logfile - \
    --error-logfile - \
    main:app
