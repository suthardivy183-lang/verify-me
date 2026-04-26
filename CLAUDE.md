# Asli — Claude Context File

## Project Overview

**Asli** (असली — "the real one") is a multilingual AI-image authenticity detector built for the
Google Solution Challenge 2026. Users upload a suspicious image; the backend runs a 3-model weighted
ensemble + signal heuristics, then calls Gemini to produce a plain-language verdict with red flags
and a media-literacy tip — in Hindi, Gujarati, or English.

**Current version:** `v0.2.0`  
**Stack:** Python 3.11 · FastAPI · PyTorch · HuggingFace Transformers · TensorFlow/Keras · Gemini API · Firebase Firestore

---

## Project Structure

```
verifyme/
├── backend/
│   ├── __init__.py
│   ├── main.py               ← FastAPI app + all routes
│   ├── detector.py           ← ensemble, heuristics, model loaders
│   ├── gemini_explainer.py   ← Gemini prompt builder + multilingual explainer (public API: generate_explanation())
│   ├── report.py             ← PDF report generation (ReportLab)
│   ├── demo.py               ← quick CLI test script
│   ├── requirements.txt
│   └── samples/              ← backend test images
├── frontend/
│   ├── index.html            ← single-page app entry point
│   ├── app.js                ← all frontend logic (screens, i18n, API calls)
│   ├── styles.css            ← custom CSS (scan animation, shimmer, safe-area)
│   ├── assets/
│   │   └── logo.svg          ← app icon (Devanagari अ on green rounded square)
│   └── legacy/               ← old React prototype — NOT active, keep for reference only
│       ├── App.jsx / Dashboard.jsx / History.jsx / Verify.jsx / ui.jsx / react.jsx
│       └── index-react.html
├── models/
│   ├── xception_5o.h5        ← 143 MB Xception (FaceForensics++), NOT committed (.gitignore)
│   └── README.md
├── tests/
│   ├── __init__.py
│   ├── conftest.py           ← adds backend/ to sys.path
│   └── test_gemini_explainer.py ← unit tests for gemini_explainer (no real API calls, patches _call_gemini)
├── docs/
│   └── logo.svg              ← logo for README / GitHub (larger version, 200×200)
├── samples/                  ← dev test images: aiimage, divyimage, gg, notclearimage
├── testset/
│   ├── ai_fixed/             ← 8 confirmed AI-generated images (benchmark)
│   ├── real_fixed/           ← 11 confirmed real photos (benchmark)
│   ├── ai/                   ← raw/unverified AI images
│   └── real/                 ← raw/unverified real images
├── myenv/                    ← Python 3.11 virtualenv, NOT committed
├── firebasekey.json          ← Firebase service account, NOT committed
├── .env                      ← secrets + config, NOT committed
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE                   ← MIT
└── CLAUDE.md                 ← this file
```

---

## How to Run

```bash
# Activate virtualenv (always use myenv — system Python 3.14 lacks the ML deps)
source myenv/bin/activate

# Start backend (from project root)
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Serve frontend (separate terminal, from project root)
cd frontend && python -m http.server 5500
# Open http://localhost:5500
```

Run tests:
```bash
source myenv/bin/activate
pytest tests/
```

---

## API Endpoints

| Method | Path | Status | Purpose |
|---|---|---|---|
| `GET` | `/healthz` | Active | Liveness check (Cloud Run) |
| `POST` | `/scan` | **Primary** | Upload image → verdict + multilingual explanation |
| `POST` | `/api/verify` | Deprecated | Legacy — works but adds Firestore record |
| `GET` | `/api/verifications?org_id=` | Deprecated | List past verifications |
| `GET` | `/api/report/{id}` | Deprecated | Download PDF report |
| `GET` | `/api/ping` | Deprecated | Ping |

### `/scan` request
```
POST /scan
Content-Type: multipart/form-data

image           (file)    JPEG/PNG image
target_language (string)  "hi" | "gu" | "en"  (default: "hi")
user_context    (string)  optional, e.g. "received via WhatsApp"
```

### `/scan` response
```json
{
  "verdict": "Nakli",
  "confidence_pct": 88,
  "explanation_en": "...",
  "explanation_local": "...",
  "red_flags": ["skin lacks visible pores", "..."],
  "learn_more_tip": "...",
  "source": "gemini",
  "cache_hit": false
}
```

---

## Detection Pipeline

```
Image
  ├─ Model 1: xception_5o.h5  (local Keras, FaceForensics++)       weight 10%
  ├─ Model 2: haywoodsloan/ai-image-detector-deploy (EfficientNet)  weight 60%
  ├─ Model 3: umm-maybe/AI-image-detector (ResNet50)                weight 25%
  └─ Heuristics (noise / DCT / Laplacian / local_var)               weight  5%
        ↓
  ensemble fake_probability (weighted avg; dead-model weight redistributed)
        ↓
  Gemini blend (if API key present):
      final = gemini_fake * 0.55 + ensemble_fake * 0.45
        ↓
  Verdict threshold:
      < 0.40  → Asli     (Real)
    0.40–0.65 → Shak hai (Uncertain)
      > 0.65  → Nakli    (Fake)
```

---

## Model Configuration

| Role | Model | Weight | Notes |
|---|---|---|---|
| Model 1 | `xception_5o.h5` (local Keras) | 10% | Face-swap specialist; weak on diffusion |
| Model 2 | `haywoodsloan/ai-image-detector-deploy` | 60% | Best overall — F1 0.94, separation 0.901 |
| Model 3 | `umm-maybe/AI-image-detector` | 25% | 0 false positives; only ~25% recall |
| Heuristics | noise / DCT / Laplacian / local_var | 5% | Signal-level fallback |
| Gemini | `gemini-2.5-flash` (optional) | 55% blend | Free tier = 20 req/day; falls back gracefully |

### Benchmark results (19-image testset, last run)

| Model | F1 | Accuracy | Avg AI score | Avg Real score | Separation |
|---|---|---|---|---|---|
| haywoodsloan EfficientNet | **0.94** | **95%** | 0.961 | 0.060 | **0.901** |
| umm-maybe ResNet50 | 0.40 | 63% | 0.400 | 0.130 | 0.270 |
| Xception | 0.20 | 58% | 0.420 | 0.333 | 0.087 |

### Rejected models — do NOT re-add without re-benchmarking

| Model | Reason |
|---|---|
| SigLiP | Inverted — avg 0.835 fake score on real images |
| DeepFake-v2 | Near-zero separation (0.029) |
| Organika/sdxl-detector | Identical output to umm-maybe; no added value |

---

## Heuristics Thresholds (detector.py)

| Signal | Threshold | Logic |
|---|---|---|
| Gaussian noise std | `< 6.0` | Real cameras always have noise > 6 |
| DCT high-freq energy | `< 0.008` | Diffusion models suppress high-freq detail |
| Channel std (color variance) | `< 30` | Low = AI flat colour |
| Laplacian variance | `< 400` | Low = unnaturally smooth (AI skin) |
| Local variance CV | `< 0.75` | Low = overly uniform AI texture |

**Known gotcha:** `cv2.Laplacian` crashes on float32 input with `CV_64F`.
Fix already in code: `gray_u8 = gray.astype(np.uint8)` before calling Laplacian.

---

## gemini_explainer.py — Public API

```python
from gemini_explainer import generate_explanation

result = generate_explanation(
    image_bytes=b"...",          # raw image bytes
    fake_prob=0.88,              # float 0.0–1.0 from ensemble
    features={...},              # heuristics + model scores dict
    target_language="hi",        # "hi" | "gu" | "en"
)
# Returns dict with keys:
# verdict, confidence_pct, explanation_en, explanation_local,
# red_flags, learn_more_tip, source ("gemini" | "template")
# Never raises — falls back to deterministic template if Gemini fails.
```

LRU response cache keyed on `sha256(image_bytes)[:12] + target_language`.

---

## Frontend (app.js)

Three screens managed by `showScreen(id)`:
- `screen-upload` — file pick / camera / drag-drop → `screen-scanning`
- `screen-scanning` — animated scan line while API call is in flight
- `screen-result` — verdict badge, confidence bar, explanation, red flags, tip
- `screen-error` — error state with retry

**i18n:** `STRINGS` object in `app.js` has keys for every UI label in `hi`, `gu`, `en`.  
Active locale stored in `window.__lang`, toggled by header pill buttons, applied via `applyStrings()`.

**Verdict labels (locale-aware):**

| Code | Hindi | Gujarati | English |
|---|---|---|---|
| Asli | असली | અસલી | Real |
| Nakli | नक़ली | નકલી | Fake |
| Shak hai | शक है | શક છે | Uncertain |

**API base URL:** `window.ASLI_API_URL` set in `index.html` — override for prod deploy.

---

## Environment Variables (`.env` at project root)

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Gemini 2.5 Flash; omit to run ensemble-only |
| `FIREBASE_KEY_PATH` | Optional | Absolute path to `firebasekey.json`; omit for in-memory fallback |
| `IMAGE_MODEL_PATH` | Optional | Absolute path to `models/xception_5o.h5` |
| `MODEL_PROBABILITY_INDEX` | Optional | Output index to read as fake probability |
| `MODEL_HIGH_VALUE_LABEL` | Optional | Label string that maps to "fake" |
| `VIDEO_MAX_FRAMES` | Optional | Max frames for video analysis |
| `ALLOWED_ORIGINS` | Optional | CORS origins, comma-separated (default `*` for dev) |
| `ALLOWED_ORIGIN_REGEX` | Optional | CORS regex for wildcard patterns (prod) |
| `PORT` | Optional | Server port (default 8000) |

`main.py` loads `.env` from the project root:
```python
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
```

---

## Dependency Notes

- **Always use `myenv`** — system Python 3.14 does not have the ML dependencies
- `protobuf == 6.31.1` required for TensorFlow 2.21 compatibility
- `google-ai-generativelanguage` may warn about protobuf >= 6 — Gemini still works
- Firebase falls back to in-memory `local_verifications` dict if `firebasekey.json` is absent

---

## Git Branches

| Branch | Purpose |
|---|---|
| `main` | Stable — matches last reviewed state |
| `feat/repo-polish` | Current — README rewrite, new frontend, tests, docs (open PR to merge) |
| `feature/my-work` | Earlier feature work |

---

## Known Issues / What's Weak

- **umm-maybe low recall** — catches only ~25% of AI images (never false-positives but misses a lot)
- **Gemini rate-limited** — 20 req/day free tier; most scans run ensemble-only
- **Heuristics weak on modern diffusion** — noise/DCT designed for GAN artifacts; SD/Midjourney passes all checks
- **Xception too narrow** — face-swap specialist only; already reduced to 10% weight
- **Small benchmark** — 19 images; ensemble weights may not generalise to diverse input

---

## Suggested Next Steps

1. Replace `umm-maybe` with a higher-recall model for diffusion images
2. Lower `umm-maybe` threshold from 0.5 → ~0.3 and re-benchmark recall
3. Add a CLIP-based zero-shot probe as a 4th lightweight signal
4. Expand benchmark to 100+ images across SD, Midjourney, DALL-E, etc.
5. Investigate local VLM (LLaVA / Moondream) as Gemini fallback to remove rate-limit dependency
6. Merge `feat/repo-polish` → `main` after judge review
