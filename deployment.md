# Asli — Deployment Guide

> **DO NOT run these commands automatically.** Run them manually in your terminal
> using your own Google account.

---

## Prerequisites

- Google Cloud project: `asli-solution-challenge` (billing enabled)
- `gcloud` CLI installed and working
- Firebase CLI: `npm install -g firebase-tools`
- Gemini API key ready

---

## 1 — One-time setup

```bash
# Authenticate with Google
gcloud auth login
gcloud config set project asli-solution-challenge

# Enable required APIs (takes ~60 s, safe to re-run)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

---

## 2 — Deploy backend to Cloud Run

Run from the **project root** (`verifyme/`):

```bash
# Replace YOUR_GEMINI_KEY with your actual key.
# ALLOWED_ORIGINS must include both Firebase Hosting domains.

gcloud run deploy asli-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --cpu-boost \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "GEMINI_API_KEY=YOUR_GEMINI_KEY,ALLOWED_ORIGINS=https://asli-solution-challenge.web.app\,https://asli-solution-challenge.firebaseapp.com"
```

**Note the URL it prints** — it will look like:
```
https://asli-api-xxxxxxxxxx-as.a.run.app
```

You will need this for Step 4.

### What happens during deploy

1. Cloud Build reads the `Dockerfile` at the project root.
2. Pip packages are installed (PyTorch CPU-only, ~800 MB).
3. HuggingFace weights are downloaded into the image (~750 MB, cached between builds).
4. Total build time: ~10-15 min on first run; ~3-5 min on subsequent code-only deploys.
5. Final image is ~2.1 GB compressed (well under the 4 GB Cloud Run limit).

### Cold start behaviour

The first request after a cold start triggers model loading from disk into memory
(~15-20 s). All subsequent requests are fast (<5 s). To eliminate cold starts
completely, add `--min-instances 1` (incurs a small continuous cost).

---

## 3 — Deploy frontend to Firebase Hosting

Run from the **`frontend/`** directory:

```bash
cd frontend

# Login to Firebase (one-time)
npx firebase login

# Initialise hosting — answer the prompts as shown below:
npx firebase init hosting
# ? Please select an option: Use an existing project
# ? Select a default Firebase project: asli-solution-challenge
# ? What do you want to use as your public directory? . (dot, current dir)
# ? Configure as a single-page app (rewrite all urls to /index.html)? No
# ? Set up automatic builds and deploys with GitHub? No

# Deploy
npx firebase deploy --only hosting
```

Note the hosting URL it prints:
```
https://asli-solution-challenge.web.app
```

---

## 4 — Wire the frontend to the backend

After Step 2 you have the Cloud Run URL. Open `frontend/index.html` and replace
the placeholder in the config block near the top of `<head>`:

```html
<script>
  window.ASLI_API_URL = 'https://asli-api-xxxxxxxxxx-as.a.run.app';
</script>
```

Then redeploy the frontend:

```bash
cd frontend && npx firebase deploy --only hosting
```

---

## 5 — Smoke-test the live deployment

```bash
# From the project root:
bash scripts/test_deployment.sh https://asli-api-xxxxxxxxxx-as.a.run.app
```

---

## Environment variables reference

| Variable | Required | Value for prod |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Your Gemini 2.5 Flash key |
| `ALLOWED_ORIGINS` | **Yes** | `https://asli-solution-challenge.web.app,https://asli-solution-challenge.firebaseapp.com` |
| `IMAGE_MODEL_PATH` | No | Omit — Xception model skipped gracefully |
| `FIREBASE_KEY_PATH` | No | Omit — backend `/scan` is stateless; frontend writes Firestore directly |
| `ALLOWED_ORIGIN_REGEX` | No | Set if you add custom domains, e.g. `.*\.run\.app` |
| `PORT` | No | Set automatically by Cloud Run (default 8080) |

---

## Updating the backend

```bash
# From the project root — re-triggers Cloud Build
gcloud run deploy asli-api \
  --source . \
  --region asia-south1
  # (all other flags are remembered from the previous deploy)
```

## Rollback

```bash
# List revisions
gcloud run revisions list --service asli-api --region asia-south1

# Roll back to a specific revision
gcloud run services update-traffic asli-api \
  --region asia-south1 \
  --to-revisions REVISION_NAME=100
```

## View logs

```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND resource.labels.service_name=asli-api' \
  --limit 100 \
  --format 'value(jsonPayload)'
```
