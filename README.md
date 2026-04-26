# Asli

Asli is now organized into a clearer full-stack layout with separate `frontend` and `backend` folders.

## Structure

```text
verify-me/
|-- backend/
|   |-- __init__.py
|   |-- .env.example
|   |-- demo.py
|   |-- detector.py
|   |-- main.py
|   |-- report.py
|   |-- requirements.txt
|   `-- samples/
|       `-- gg.jpeg
|-- frontend/
|   |-- index.html
|   |-- App.jsx
|   |-- Dashboard.jsx
|   |-- History.jsx
|   |-- Verify.jsx
|   |-- ui.jsx
|   `-- legacy/
|       `-- react.jsx
|-- .gitignore
`-- README.md
```

## What lives where

- `backend/` contains the FastAPI API, detection logic, PDF generation, environment config, and sample backend assets.
- `frontend/` contains the browser UI files for the dashboard, verification flow, history screen, and shared UI helpers.
- `frontend/legacy/react.jsx` is the older single-file frontend kept for reference only.

## Run the backend

From the repo root:

```powershell
python -m venv myenv
.\myenv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m backend.main
```

The API starts on `http://127.0.0.1:8000`.

Useful endpoints:

- `GET /api/ping`
- `POST /api/verify`
- `GET /api/verifications?org_id=demo_org`
- `GET /api/report/{verification_id}`

## Frontend

Open `frontend/index.html` in a browser, or serve the `frontend/` folder with a simple static server. The UI expects the backend at `http://localhost:8000`.

The active frontend is composed of:

- `frontend/index.html`
- `frontend/ui.jsx`
- `frontend/App.jsx`
- `frontend/Dashboard.jsx`
- `frontend/Verify.jsx`
- `frontend/History.jsx`

## Environment variables

See `backend/.env.example`.

Main settings:

- `GEMINI_API_KEY`
- `FIREBASE_KEY_PATH`
- `IMAGE_MODEL_PATH`
- `MODEL_PROBABILITY_INDEX`
- `MODEL_HIGH_VALUE_LABEL`
- `VIDEO_MAX_FRAMES`

## Notes

- If `GEMINI_API_KEY` is missing, Gemini analysis is disabled and the app falls back to local heuristics.
- If `IMAGE_MODEL_PATH` is empty, the optional local Keras model is not used.
- If Firebase is unavailable, verification history is stored in memory for the current process only.
- The sample upload file now lives at `backend/samples/gg.jpeg`.
