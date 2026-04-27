#!/bin/bash
# Usage: bash scripts/test_deployment.sh https://asli-api-xxxxxxxxxx-as.a.run.app
set -euo pipefail

API_URL="${1:-}"
if [[ -z "$API_URL" ]]; then
  echo "Usage: $0 <cloud-run-url>"
  echo "  Example: $0 https://asli-api-xxxxxxxxxx-as.a.run.app"
  exit 1
fi

# Strip trailing slash
API_URL="${API_URL%/}"

# Resolve a real sample image to use for the scan test
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SAMPLE_IMAGE="${PROJECT_ROOT}/samples/divyimage.jpeg"

if [[ ! -f "$SAMPLE_IMAGE" ]]; then
  echo "⚠  Sample image not found at $SAMPLE_IMAGE"
  echo "   Provide any JPEG/PNG: SAMPLE_IMAGE=/path/to/img.jpg $0 $API_URL"
  SAMPLE_IMAGE="${SAMPLE_IMAGE:-}"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo " Asli deployment smoke-test"
echo " Target: $API_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Health check ────────────────────────────────────────────────────────
echo "1/3  GET /healthz ..."
HEALTH=$(curl -sf --max-time 30 "$API_URL/healthz") || {
  echo "✗  /healthz failed — is the Cloud Run URL correct?"
  exit 1
}
echo "     Response: $HEALTH"
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")
if [[ "$STATUS" != "ok" ]]; then
  echo "✗  Expected status=ok, got: $STATUS"
  exit 1
fi
echo "     ✓ /healthz OK"
echo ""

# ── 2. Scan with a real image ──────────────────────────────────────────────
if [[ -n "$SAMPLE_IMAGE" && -f "$SAMPLE_IMAGE" ]]; then
  echo "2/3  POST /scan (Hindi, real image: $(basename "$SAMPLE_IMAGE")) ..."
  SCAN=$(curl -sf --max-time 120 \
    -X POST "$API_URL/scan" \
    -F "image=@${SAMPLE_IMAGE}" \
    -F "target_language=hi") || {
    echo "✗  /scan failed"
    exit 1
  }
  VERDICT=$(echo "$SCAN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('verdict','?'))" 2>/dev/null || echo "?")
  CONF=$(echo "$SCAN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('confidence_pct','?'))" 2>/dev/null || echo "?")
  echo "     Verdict: $VERDICT  |  Confidence: $CONF%"
  echo "     ✓ /scan OK"
else
  echo "2/3  Skipping /scan (no sample image found)"
fi
echo ""

# ── 3. CORS check ─────────────────────────────────────────────────────────
echo "3/3  OPTIONS /scan (CORS preflight from Firebase Hosting) ..."
CORS_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 \
  -X OPTIONS "$API_URL/scan" \
  -H "Origin: https://asli-solution-challenge.web.app" \
  -H "Access-Control-Request-Method: POST")
if [[ "$CORS_STATUS" == "200" || "$CORS_STATUS" == "204" ]]; then
  echo "     ✓ CORS preflight OK (HTTP $CORS_STATUS)"
else
  echo "     ⚠  CORS preflight returned HTTP $CORS_STATUS"
  echo "        Check ALLOWED_ORIGINS env var on the Cloud Run service."
fi
echo ""

echo "═══════════════════════════════════════════════"
echo " ✓ Deployment looks healthy!"
echo "═══════════════════════════════════════════════"
echo ""
