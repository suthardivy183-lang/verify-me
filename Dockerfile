# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Asli backend — multi-stage Docker image for Cloud Run
#
# Layer order (optimised for Cloud Build cache):
#   1. system runtime libs     (changes: never)
#   2. Python deps             (changes: when requirements.txt changes)
#   3. HuggingFace model cache (changes: when models change)
#   4. app code                (changes: every deploy)
#
# Estimated final image size:
#   python:3.11-slim          ~130 MB
#   system libs               ~30  MB
#   PyTorch CPU + deps        ~1.1 GB
#   HF models (3 models)      ~750 MB
#   app code + misc           ~50  MB
#   ─────────────────────────────────
#   Total (compressed)        ~2.1 GB  ✓ well under the 4 GB Cloud Run limit
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install Python packages ─────────────────────────────────────────
FROM python:3.11-slim AS deps

WORKDIR /install

# System build tools (only needed to compile some pip packages; NOT in runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

# Install PyTorch CPU-only FIRST so pip's resolver never picks the ~4 GB CUDA wheel.
# The --index-url flag is intentionally scoped to this one RUN command only.
RUN pip install --no-cache-dir --user \
      "torch>=2.2.0" \
      --index-url https://download.pytorch.org/whl/cpu

# Install the rest of the deps:
#   - swap opencv-python → opencv-python-headless (no X11 / Qt on a server)
#   - drop pytest (dev-only)
#   - gunicorn is not in requirements.txt, add it here
RUN sed 's/^opencv-python/opencv-python-headless/' requirements.txt \
    | grep -v '^pytest' \
    > /tmp/req.txt \
    && pip install --no-cache-dir --user -r /tmp/req.txt \
    && pip install --no-cache-dir --user gunicorn \
    && rm /tmp/req.txt


# ── Stage 2: download HuggingFace weights (separate layer for cache hits) ────
FROM python:3.11-slim AS model-cache

COPY --from=deps /root/.local /root/.local
ENV PATH="/root/.local/bin:$PATH" \
    HF_HOME=/hf-cache

# Download all three model weights at build time so cold starts are fast.
# Each pipeline() / from_pretrained() call fetches weights + tokeniser files
# and stores them under HF_HOME. The resulting layer is ~750 MB.
RUN python -c "
from transformers import pipeline, CLIPModel, CLIPProcessor
print('→ haywoodsloan/ai-image-detector-deploy (EfficientNet)', flush=True)
pipeline('image-classification', model='haywoodsloan/ai-image-detector-deploy')
print('→ umm-maybe/AI-image-detector (ResNet50)', flush=True)
pipeline('image-classification', model='umm-maybe/AI-image-detector')
print('→ openai/clip-vit-base-patch32 (CLIP fallback)', flush=True)
CLIPModel.from_pretrained('openai/clip-vit-base-patch32')
CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
print('All model weights cached.', flush=True)
"


# ── Stage 3: final runtime image ─────────────────────────────────────────────
FROM python:3.11-slim

# Runtime system libs only (no build tools)
#   libgomp1   — OpenMP, required by PyTorch
#   libglib2.0-0 — glib, required by opencv-python-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgomp1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Bring in pip packages and model weights from the previous stages
COPY --from=deps       /root/.local  /root/.local
COPY --from=model-cache /hf-cache    /hf-cache

ENV PATH="/root/.local/bin:$PATH" \
    HF_HOME=/hf-cache \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# App code last — only this layer changes on every code deploy
COPY backend/ .

# Cloud Run injects $PORT at runtime (default 8080 as fallback)
EXPOSE 8080

# 2 workers: Cloud Run CPU boost gives 2 vCPUs — use both.
# --timeout 300: allows for cold-start model loading (~15-20 s) + inference.
# IMAGE_MODEL_PATH is not set → Keras/Xception is skipped gracefully.
CMD ["sh", "-c", \
     "exec gunicorn main:app \
       -w 2 \
       -k uvicorn.workers.UvicornWorker \
       -b :${PORT:-8080} \
       --timeout 300 \
       --log-level info"]
