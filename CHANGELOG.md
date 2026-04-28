# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v0.3.0] — 2026-04-28

### Added
- **Live deployment** to Google Cloud Run (`asia-south1`) and Firebase Hosting
- Multi-stage Dockerfile with PyTorch CPU-only wheel + pre-cached HuggingFace models for fast cold-starts
- Multilingual PDF forensic reports (English / Hindi / Gujarati) via jsPDF
  with canvas-rendered Devanagari and Gujarati glyphs
- Settings panel with account export, account delete, and history view
- Real getUserMedia camera modal for desktop "Take a photo" flow
  (mobile keeps native capture)
- Privacy policy page at `/privacy.html`
- Cloud Run smoke-test script at `scripts/test_deployment.sh`

### Changed
- Wired real Firebase web SDK config; Google sign-in now functional
- CORS hardened to explicit origins (`asli-solution-challenge.web.app` + localhost)
- Dropped legacy React prototype (`frontend/legacy/`) — vanilla JS app is the
  single source of truth

---

## [v0.2.0] — 2026-04-26

### Changed
- Rebranded to **Asli** (असली) for Google Solution Challenge 2026
- Tagline: "असली या नक़ली? Know in seconds."
- Renamed all in-code and UI references from "VerifyMe" → "Asli"

---

## [v0.1.0] — 2026-04-24

### Added
- Three-model ensemble pipeline: Xception + haywoodsloan EfficientNet + umm-maybe ResNet50
- Weighted ensemble (10 / 60 / 25 / 5%) calibrated from benchmark (19-image test set)
- Heuristic signals: Gaussian noise, DCT high-freq energy, Laplacian variance, local variance CV
- Optional Gemini 2.5 Flash refinement (55% blend when available)
- FastAPI backend with `/api/verify`, `/api/verifications`, `/api/report/{id}` endpoints
- Firebase Firestore storage with in-memory fallback
- PDF report generation via ReportLab
- Reorganized project into `backend/`, `frontend/`, `models/`, `samples/`, `testset/` structure
