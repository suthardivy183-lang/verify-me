# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
