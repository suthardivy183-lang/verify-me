#!/bin/bash
# Deploy Asli backend to Google Cloud Run from the project root.
# Run from the verify-me/ directory after `git pull`.
#
# Usage:
#   bash scripts/deploy_cloud_run.sh
#
# This works in:
#   - Google Cloud Shell (no install needed)  →  https://shell.cloud.google.com/
#   - Local machine with gcloud CLI installed →  https://cloud.google.com/sdk/docs/install

set -euo pipefail

PROJECT_ID="asli-solution-challenge"
REGION="asia-south1"
SERVICE_NAME="asli-api"
GEMINI_API_KEY="${GEMINI_API_KEY:-AIzaSyC38sT6UidDUnqSKxu6a5Tg963KIbAXmXk}"

ALLOWED_ORIGINS="https://asli-solution-challenge.web.app,https://asli-solution-challenge.firebaseapp.com,http://localhost:5500,http://localhost:8000"

echo "==> Setting project to ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "==> Enabling required APIs (idempotent)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

echo "==> Deploying ${SERVICE_NAME} to Cloud Run (${REGION})"
echo "    This rebuilds from Dockerfile and takes 10-15 min on first deploy."

gcloud run deploy "${SERVICE_NAME}" \
    --source . \
    --region "${REGION}" \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --cpu-boost \
    --timeout 300 \
    --min-instances 1 \
    --max-instances 5 \
    --set-env-vars "^@^GEMINI_API_KEY=${GEMINI_API_KEY}@ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"

echo ""
echo "==> Deployed. Service URL:"
gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format "value(status.url)"

echo ""
echo "==> Health check:"
URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format "value(status.url)")
curl -s "${URL}/healthz"
echo ""
echo ""
echo "==> Done. Update frontend/index.html ASLI_API_URL with the URL above,"
echo "    then run:  cd frontend && npx firebase deploy --only hosting"
