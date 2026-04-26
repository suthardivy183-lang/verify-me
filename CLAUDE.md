# VerifyMe — Session Notes for Claude

## Project Overview

FastAPI backend that detects whether an image, video, or document is AI-generated or real.
Stack: Python 3.11, FastAPI, TensorFlow/Keras, PyTorch, HuggingFace Transformers, Gemini API, Firebase Firestore.

## Project Structure

```
verifyme/
├── backend/           ← all Python server code
│   ├── main.py        ← FastAPI app + routes
│   ├── detector.py    ← detection logic (models, ensemble, heuristics, Gemini)
│   ├── report.py      ← PDF report generation
│   ├── demo.py        ← quick test script
│   └── requirements.txt
├── frontend/          ← UI files
│   ├── index.html
│   └── react.jsx
├── models/            ← local ML model weights
│   └── xception_5o.h5 (143MB, Xception trained on FaceForensics++)
├── samples/           ← test images used during development
│   ├── aiimage.jpeg
│   ├── divyimage.jpeg
│   ├── gg.jpeg
│   └── notclearimage.jpeg
├── testset/           ← benchmark images
│   ├── ai_fixed/      (8 confirmed AI-generated images)
│   └── real_fixed/    (11 confirmed real photos)
├── myenv/             ← Python 3.11 virtualenv (not committed)
├── firebasekey.json   ← Firebase service account (not committed)
├── .env               ← all secrets and config (not committed)
├── .gitignore
├── README.md
└── CLAUDE.md          ← this file
```

Run server (always from project root):
```bash
source myenv/bin/activate
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## What We Did This Session

### 1. Diagnosed Inverted Scores
Real images were getting high risk scores and AI images were getting low risk scores.
Root cause: Xception (trained on face-swaps) was getting 100% of the weight in `analyze_image()`, and heuristics were computed but never fused. Fixed with a proper weighted ensemble.

### 2. Built a Three-Model Ensemble Pipeline

Pipeline flow:
```
Image → Model 1 (Xception) + Model 2 (EfficientNet) + Model 3 (HF detector)
      → Ensemble (weighted average)
      → Optional Gemini refinement
      → Final score + verdict
```

Added to `detector.py`:
- `load_efficientnet_model()` — `@lru_cache` loader for Model 2
- `load_hf_detector_model()` — `@lru_cache` loader for Model 3
- `_run_hf_pipeline()` — shared inference runner for both HF models
- `predict_with_efficientnet()` / `predict_with_hf_detector()` — model wrappers
- `ensemble_image_predictions()` — weighted average with dead-model weight redistribution
- `_analyze_image_with_gemini()` — optional Gemini refinement
- `_labels_to_fake_probability()` — maps HF label+score output to fake_probability using keyword sets

### 3. Fixed Heuristics

Original thresholds almost never fired on modern diffusion-generated images. Raised them and added two new signals:

| Signal | Old threshold | New threshold | Logic |
|---|---|---|---|
| Gaussian noise | < 2.5 | < 6.0 | Real cameras always have noise > 6 |
| DCT high-freq energy | < 0.001 | < 0.008 | Diffusion models lack high-freq detail |
| Channel std | < 30 | (unchanged) | Low color variance = AI |
| Laplacian variance | (new) | < 400 | Low = unnaturally smooth |
| Local var CV | (new) | < 0.75 | Low = overly uniform AI texture |

Also fixed a crash: `cv2.Laplacian` on float32 gray image fails with `CV_64F`. Fixed by converting to uint8 first: `gray_u8 = gray.astype(np.uint8)`.

### 4. Fixed .env MODEL PATH

`.env` had `IMAGE_MODEL_PATH=models/xception_5o.h5` but the file lives at the project root.
After reorganization the correct absolute path is:
`IMAGE_MODEL_PATH=/Users/suthardivydevendrabhai/Desktop/verifyme/models/xception_5o.h5`
`FIREBASE_KEY_PATH=/Users/suthardivydevendrabhai/Desktop/verifyme/firebasekey.json`

`main.py` loads `.env` from the project root using:
`load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))`

### 5. Ran a Full Benchmark

Built a test set in `testset/`:
- `real_fixed/` — 11 confirmed real images
- `ai_fixed/` — 8 confirmed AI-generated images

Note: Dataset `Parveshiiii/AI-vs-Real` had **inverted labels** (binary_label=0=AI, binary_label=1=real). Had to swap images into correct folders manually.

Tested 6 models. Results:

| Model | F1 | Accuracy | Avg AI score | Avg Real score | Separation |
|---|---|---|---|---|---|
| haywoodsloan/ai-image-detector-deploy | **0.94** | **95%** | 0.961 | 0.060 | **0.901** |
| umm-maybe/AI-image-detector | 0.40 | 63% | 0.400 | 0.130 | 0.270 |
| Xception | 0.20 | 58% | 0.420 | 0.333 | 0.087 |
| SigLiP (tested, rejected) | — | — | 0.148 | **0.835** | negative |
| DeepFake-v2 (tested, rejected) | — | — | — | — | 0.029 |
| Organika/sdxl-detector (rejected) | — | — | identical to umm-maybe | — | — |

SigLiP was catastrophic — it gave avg 0.835 fake score to REAL images.
DeepFake-v2 had near-zero separation (couldn't distinguish real from AI at all).
Both were reverted. Original models restored.

### 6. Updated Ensemble Weights Based on Benchmark

Before (stale weights with wrong model comments):
```python
("xception",     xception,     0.15),   # face-swap specialist
("efficientnet", efficientnet, 0.50),   # SigLiP — STALE COMMENT
("hf_detector",  hf_detector,  0.30),   # Organika ViT — STALE COMMENT
```

After (benchmark-calibrated):
```python
("xception",     xception,     0.10),   # Xception — face-swap specialist (F1=0.20)
("efficientnet", efficientnet, 0.60),   # haywoodsloan EfficientNet — best model (F1=0.94, sep=0.901)
("hf_detector",  hf_detector,  0.25),   # umm-maybe ResNet50 — good specificity (0 false positives)
```

Heuristics weight remains 0.05.

---

## Current Model Configuration

| Role | Model | Weight | Notes |
|---|---|---|---|
| Model 1 | `xception_5o.h5` (local Keras) | 10% | Face-swap specialist, weak on diffusion |
| Model 2 | `haywoodsloan/ai-image-detector-deploy` | 60% | Best overall, EfficientNet |
| Model 3 | `umm-maybe/AI-image-detector` | 25% | 0 false positives, low recall (25%) |
| Heuristics | noise/DCT/Laplacian/local_var | 5% | Signal-level fallback |
| Gemini | `gemini-2.5-flash` (optional) | 55% blend | Rate-limited on free tier (20 req/day) |

Gemini blend when available: `final = gemini_fake * 0.55 + ensemble_fake * 0.45`

---

## Known Issues / What's Still Weak

- **umm-maybe low recall**: catches only ~25% of AI images. When it fires it's always right, but it misses most. Lowering its internal threshold or replacing it with a stronger complementary model would help.
- **Gemini rate-limited**: free tier = 20 requests/day. Ensemble runs alone most of the time.
- **Heuristics still weak on modern diffusion models**: noise/DCT features were designed for GAN artifacts. Photorealistic SD/Midjourney images pass all heuristic checks.
- **Xception only catches face-swaps**: nearly useless for general AI image detection. Weight is already down to 10%.
- **Small benchmark (19 images)**: weights are calibrated on a small test set. May not generalize.

---

## Key Files

| File | Purpose |
|---|---|
| `backend/detector.py` | All detection logic — models, ensemble, heuristics, Gemini |
| `backend/main.py` | FastAPI routes: `/api/verify`, `/api/verifications`, `/api/report/{id}` |
| `backend/report.py` | PDF report generation via ReportLab |
| `backend/requirements.txt` | Python dependencies |
| `frontend/index.html` | Web UI |
| `frontend/react.jsx` | React component |
| `models/xception_5o.h5` | Local Xception model (143MB, FaceForensics++ trained) |
| `.env` | API keys and config (GEMINI_API_KEY, IMAGE_MODEL_PATH, etc.) — project root |
| `testset/` | Benchmark images: `real_fixed/` (11) and `ai_fixed/` (8) |
| `samples/` | Dev test images (aiimage, divyimage, gg, notclearimage) |
| `myenv/` | Python 3.11 virtualenv — all dependencies |

---

## Environment Notes

- Must use `myenv` virtualenv — system Python 3.14 does not have the dependencies
- Protobuf must be `== 6.31.1` for TensorFlow 2.21 compatibility (older versions cause crashes)
- `google-ai-generativelanguage` conflicts with protobuf >= 6 — Gemini import may warn but still works
- Firebase: `firebasekey.json` must be present at project root for Firestore to enable; falls back to in-memory `local_verifications` dict otherwise

---

## Label Keyword Mapping

Used by `_labels_to_fake_probability()` to interpret any HF classification model's output:

```python
_FAKE_LABEL_KEYWORDS = {"fake", "artificial", "ai", "generated", "synthetic", "deepfake", "manipulated", "sdxl"}
_REAL_LABEL_KEYWORDS = {"real", "human", "authentic", "natural", "genuine", "original", "realism"}
```

Any model whose labels contain one of these words will work automatically.

---

## Next Steps (Suggested)

1. Find a stronger Model 3 to replace `umm-maybe` — needs high recall on diffusion images with low false positive rate
2. Consider adding a CLIP-based zero-shot probe as a 4th lightweight signal
3. Run benchmark on a larger, more diverse test set (100+ images, multiple generators)
4. Investigate local VLM (e.g., LLaVA, Moondream) as a Gemini replacement to avoid rate limits
5. Lower umm-maybe threshold from default 0.5 to ~0.3 and re-benchmark to improve recall
