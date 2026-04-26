# Asli — Claude Context File

## Project Overview

**Asli** is a multilingual AI-image authenticity detector built for the Google Solution Challenge 2026.
Users upload a suspicious image; the backend runs a 3-model ensemble + heuristics, then uses Gemini to
produce a plain-language verdict (Asli / Nakli / Shak hai) with red flags and a media-literacy tip —
in Hindi, Gujarati, or English.

Stack: Python 3.11 · FastAPI · TensorFlow/Keras · PyTorch · HuggingFace Transformers · Gemini API · Firebase Firestore

---

## Project Structure

```
verifyme/
├── backend/
│   ├── __init__.py
│   ├── main.py               ← FastAPI app + all routes (/scan, /api/verify legacy, /healthz)
│   ├── detector.py           ← detection logic: ensemble, heuristics, Gemini blend
│   ├── gemini_explainer.py   ← Gemini prompt builder + multilingual explainer
│   ├── report.py             ← PDF report generation (ReportLab)
│   ├── demo.py               ← quick CLI test script
│   ├── requirements.txt
│   └── samples/              ← backend test images
├── frontend/
│   ├── index.html            ← single-page app (vanilla JS + TailwindCSS)
│   ├── app.js                ← all frontend logic (screens, i18n, API calls)
│   ├── styles.css            ← custom CSS on top of Tailwind
│   ├── assets/
│   │   └── logo.svg          ← app icon (Devanagari अ on green rounded rect)
│   └── legacy/               ← old React prototype (not active — keep for reference)
│       ├── App.jsx
│       ├── Dashboard.jsx
│       ├── History.jsx
│       ├── Verify.jsx
│       ├── ui.jsx
│       ├── react.jsx
│       └── index-react.html
├── models/
│   ├── xception_5o.h5        ← 143 MB Xception (FaceForensics++ trained, not committed)
│   └── README.md
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── test_gemini_explainer.py
├── docs/
│   └── logo.svg              ← logo for README / GitHub
├── samples/                  ← dev test images (aiimage, divyimage, gg, notclearimage)
├── testset/
│   ├── ai_fixed/             ← 8 confirmed AI-generated images
│   ├── real_fixed/           ← 11 confirmed real photos
│   ├── ai/                   ← raw (un-verified) AI images
│   └── real/                 ← raw (un-verified) real images
├── myenv/                    ← Python 3.11 virtualenv (not committed)
├── firebasekey.json          ← Firebase service account (not committed, in .gitignore)
├── .env                      ← all secrets (not committed)
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
└── CLAUDE.md                 ← this file
```

---

## How to Run

```bash
# From project root
source myenv/bin/activate
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# Serve frontend (separate terminal)
cd frontend && python -m http.server 5500
# Open http://localhost:5500
```

Run tests:
```bash
source myenv/bin/activate
pytest tests/
```

---

## Active API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness check (Cloud Run) |
| `POST` | `/scan` | **Primary** — upload image, returns verdict + multilingual explanation |
| `POST` | `/api/verify` | Legacy (deprecated) — still works, adds Firestore record |
| `GET` | `/api/verifications?org_id=` | Legacy — list verifications |
| `GET` | `/api/report/{id}` | Legacy — download PDF report |
| `GET` | `/api/ping` | Legacy ping |

`/scan` response shape:
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
  ├─ Model 1: Xception (local Keras, xception_5o.h5)       weight 10%
  ├─ Model 2: haywoodsloan/ai-image-detector-deploy         weight 60%
  ├─ Model 3: umm-maybe/AI-image-detector                   weight 25%
  └─ Heuristics (noise / DCT / Laplacian / local_var)       weight  5%
        ↓
  Weighted ensemble → fake_probability
        ↓
  Gemini blend (if available): final = gemini*0.55 + ensemble*0.45
        ↓
  Verdict: Asli (<40%) · Shak hai (40–65%) · Nakli (>65%)
```

---

## Model Configuration

| Role | Model | Weight | Notes |
|---|---|---|---|
| Model 1 | `xception_5o.h5` (local Keras) | 10% | Face-swap specialist; weak on diffusion images |
| Model 2 | `haywoodsloan/ai-image-detector-deploy` | 60% | Best overall — EfficientNet, F1=0.94, separation=0.901 |
| Model 3 | `umm-maybe/AI-image-detector` | 25% | 0 false positives but only ~25% recall |
| Heuristics | noise / DCT / Laplacian / local_var | 5% | Signal-level fallback |
| Gemini | `gemini-2.5-flash` (optional) | 55% blend | Free tier = 20 req/day; falls back to ensemble only |

Benchmark results on `testset/` (19 images, last run):

| Model | F1 | Accuracy | Avg AI score | Avg Real score | Separation |
|---|---|---|---|---|---|
| haywoodsloan/ai-image-detector-deploy | **0.94** | **95%** | 0.961 | 0.060 | **0.901** |
| umm-maybe/AI-image-detector | 0.40 | 63% | 0.400 | 0.130 | 0.270 |
| Xception | 0.20 | 58% | 0.420 | 0.333 | 0.087 |

Rejected models (do not re-add without re-benchmarking):
- **SigLiP** — inverted scores, avg 0.835 fake score on real images
- **DeepFake-v2** — near-zero separation (0.029)
- **Organika/sdxl-detector** — identical output to umm-maybe, no added value

---

## Heuristics Thresholds

| Signal | Threshold | Logic |
|---|---|---|
| Gaussian noise std | < 6.0 | Real cameras always produce noise > 6 |
| DCT high-freq energy | < 0.008 | Diffusion models suppress high-freq detail |
| Channel std (color variance) | < 30 | Low variance = AI flat color |
| Laplacian variance | < 400 | Low = unnaturally smooth (AI skin) |
| Local variance CV | < 0.75 | Low = overly uniform AI texture |

Known gotcha: `cv2.Laplacian` on a float32 gray image crashes with `CV_64F`.
Fix: `gray_u8 = gray.astype(np.uint8)` before calling Laplacian.

---

## i18n (Frontend)

`app.js` contains a `STRINGS` object with keys for every UI label in three locales: `hi` (Hindi), `gu` (Gujarati), `en` (English). The active locale is stored in `window.__lang` and toggled via the header pill buttons. All DOM text updates go through `applyStrings()`.

Verdict display names are also locale-aware:
- Real → Asli / असली / અસલી
- Fake → Nakli / नक़ली / નકલી
- Uncertain → Shak hai / शक है / શક છે

---

## Environment Variables (`.env` at project root)

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini 2.5 Flash API key |
| `FIREBASE_KEY_PATH` | Absolute path to `firebasekey.json` |
| `IMAGE_MODEL_PATH` | Absolute path to `models/xception_5o.h5` |
| `MODEL_PROBABILITY_INDEX` | Output index to read as fake probability |
| `MODEL_HIGH_VALUE_LABEL` | Label string that maps to "fake" |
| `VIDEO_MAX_FRAMES` | Max frames to sample for video analysis |
| `ALLOWED_ORIGINS` | CORS: comma-separated origins (default `*` for dev) |
| `ALLOWED_ORIGIN_REGEX` | CORS: regex for wildcard origin matching (prod) |
| `PORT` | Server port (default 8000) |

`main.py` loads `.env` from the project root:
```python
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
```

---

## Environment / Dependency Notes

- **Always activate `myenv`** — system Python 3.14 does not have the ML dependencies
- `protobuf == 6.31.1` required for TensorFlow 2.21 compatibility
- `google-ai-generativelanguage` may warn about protobuf >= 6 — Gemini still works
- Firebase: if `firebasekey.json` is absent or invalid, app falls back to in-memory `local_verifications` dict (no persistence across restarts)
- Frontend API base URL is set via `window.ASLI_API_URL` in `index.html` — change for prod deploy

---

## Known Issues / What's Weak

- **umm-maybe low recall**: only catches ~25% of AI images (but never false-positives)
- **Gemini rate-limited**: 20 req/day on free tier; ensemble-only most of the time
- **Heuristics weak on modern diffusion**: noise/DCT designed for GANs; SD/Midjourney images pass all checks
- **Xception too narrow**: face-swap only; weight already at 10%
- **Small benchmark**: 19-image test set; weights may not generalize

---

## Suggested Next Steps

1. Replace `umm-maybe` with a higher-recall model for diffusion images
2. Add a CLIP-based zero-shot probe as a 4th lightweight signal
3. Expand benchmark to 100+ images across multiple generators (SD, Midjourney, DALL-E, etc.)
4. Investigate local VLM (LLaVA / Moondream) as Gemini fallback to remove rate-limit dependency
5. Lower `umm-maybe` internal threshold from 0.5 → ~0.3 and re-benchmark recall
