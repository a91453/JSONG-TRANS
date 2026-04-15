#!/bin/bash
# ── Google Cloud Run 一鍵部署腳本 ──────────────────────────────────────────
# 使用前：gcloud auth login && gcloud config set project YOUR_PROJECT_ID

set -e

PROJECT_ID="${GCLOUD_PROJECT_ID:-$(gcloud config get-value project)}"
SERVICE_NAME="jsong-whisper"
REGION="asia-east1"           # 台灣附近最近的節點
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo ">>> 建置 Docker 映像: ${IMAGE}"
gcloud builds submit --tag "${IMAGE}" .

echo ">>> 部署至 Cloud Run (region: ${REGION})"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 5 \
  --min-instances 0 \
  --concurrency 1 \
  --set-env-vars "GROQ_API_KEY=${GROQ_API_KEY},SERVICE_SECRET=${SERVICE_SECRET},WHISPER_MODEL=whisper-large-v3-turbo"

echo ""
echo ">>> 部署完成！"
echo ">>> 服務 URL："
gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --format "value(status.url)"

echo ""
echo ">>> 請將以下環境變數加入 Next.js（Vercel Dashboard）："
echo "    SUBTITLE_SERVICE_URL=<上方 URL>"
echo "    SUBTITLE_SERVICE_SECRET=${SERVICE_SECRET}"
