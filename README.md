# VerifyMe

VerifyMe is a small full-stack prototype for identity and asset verification. It accepts an uploaded image, photo, video, or document, analyzes it for possible manipulation or AI-generation signals, stores the verification result, and generates a PDF report that can be downloaded later.

The project is intentionally lightweight. It combines:

- A FastAPI backend for uploads and API endpoints
- A detector module for image, video, and document analysis
- A React frontend for upload and history views
- A PDF report generator
- Optional Firebase / Firestore persistence

This README is designed to explain not only how to run the project, but also why each file and major import exists.

## What the app does

At a high level, the app works like this:

1. A user uploads a file from the frontend.
2. The backend receives the file through `/api/verify`.
3. The backend stores the uploaded file temporarily.
4. The backend calls the detector logic based on the selected `asset_type`.
5. The detector returns a prediction, confidence, risk score, and detailed signals.
6. The backend stores the result in Firebase if available, or in memory if Firebase is disabled.
7. The frontend can fetch verification history and download a generated PDF report.

## Project structure

These are the main files in the project:

- `main.py`
  The FastAPI application. It defines the API routes, handles uploads, coordinates detector calls, stores verification results, and serves PDF reports.

- `detector.py`
  The core analysis engine. It contains the logic for image, video, and document verification.

- `report.py`
  Generates a PDF report from a verification result using ReportLab.

- `react.jsx`
  A simple React frontend that lets a user upload files, view results, browse verification history, and download reports.

- `demo.py`
  A helper script that seeds demo verification records into Firestore.

- `requirements.txt`
  The Python dependency list needed for the backend and detector.

- `gg.jpeg`
  A sample image asset in the repository, useful for quick local testing.

## Why Firebase is used

Firebase, specifically Cloud Firestore, is used as the project's persistence layer.

Without persistence, verification results would disappear every time the backend restarts. Firestore solves that by giving the project:

- A place to store verification history
- A way to fetch previous results by organization ID
- A source of truth for generating reports later

In this project, Firebase is not the detection engine. It is only the storage layer.

That means Firebase is used for:

- Saving each verification result after analysis
- Loading prior verifications for the history screen
- Looking up a specific verification when generating a PDF report

The backend now also supports a Firebase-optional mode. If Firebase is not installed or credentials are missing, the app falls back to an in-memory dictionary for local development. That keeps the API from crashing, but local records disappear when the process stops.

## Backend architecture

The backend lives primarily in `main.py`.

### `main.py` responsibilities

`main.py` is the entrypoint of the API. It is responsible for:

- Creating the FastAPI app
- Enabling CORS so the frontend can call the backend from the browser
- Receiving uploaded files
- Routing different asset types to the correct detector function
- Storing verification results
- Returning verification history
- Building and serving PDF reports
- Exposing a health-check endpoint at `/api/ping`

### Important API routes

- `POST /api/verify`
  Accepts a multipart upload and runs the correct verification path.

- `GET /api/verifications?org_id=demo_org`
  Returns recent verification history for an organization.

- `GET /api/report/{verification_id}`
  Generates and returns a PDF report for a specific verification.

- `GET /api/ping`
  A simple health check that returns `{"status": "ok"}`.

## Detection architecture

The detection logic lives in `detector.py`.

This module supports three asset classes:

- Images / photos
- Videos
- Documents

Each type uses a slightly different strategy.

### Image analysis

Image analysis combines up to three signal sources:

- A machine learning model, if `IMAGE_MODEL_PATH` is configured and the model loads successfully
- Metadata analysis, especially EXIF fields and known AI-tool markers
- Image heuristics like noise, DCT high-frequency energy, and channel variation

These signals are fused into one final fake probability, then translated into:

- `prediction`
- `confidence`
- `risk_level`
- `risk_score`
- `verdict`
- `signals`

If no model is configured, image analysis still works in fallback mode using metadata and heuristics.

### Video analysis

Video analysis samples frames from the uploaded video and evaluates each frame similarly to an image.

The video path:

1. Opens the video with OpenCV
2. Samples a set of frames
3. Runs image-style analysis per frame
4. Aggregates frame scores into one video-level result

If the image model is unavailable, video analysis still runs using fallback heuristics on frames.

### Document analysis

Document analysis is currently heuristic-based, not model-based.

It:

- Reads bytes from the file
- Attempts basic text extraction
- Computes repetition and vocabulary metrics
- Looks for patterns that may indicate machine-generated text

This is intentionally a lightweight local baseline. The code also leaves room to plug in an external document detection API later.

## File-by-file explanation

### `main.py`

This is the backend application file.

Key behaviors:

- Imports FastAPI and creates the API app
- Handles optional Firebase setup
- Writes uploaded files temporarily before processing
- Calls `analyze_image`, `analyze_video`, or `analyze_document`
- Stores the result in Firestore or local memory
- Returns structured JSON responses to the frontend

Notable implementation detail:

- Firebase is guarded so the app can still run locally without `firebase_admin` or a service account key.

### `detector.py`

This file contains the detection and scoring logic.

It is the most algorithmic file in the project.

Major responsibilities:

- Load and cache a Keras model, if provided
- Normalize and preprocess images
- Extract prediction probabilities
- Analyze image EXIF metadata
- Compute image heuristics
- Fuse heuristic and model results
- Analyze document text
- Sample video frames and aggregate per-frame scores

It also standardizes the result shape so the backend can treat all asset types similarly.

### `report.py`

This file generates a PDF summary using ReportLab.

The report includes:

- Candidate ID
- Organization ID
- Timestamp
- Asset type
- Final verdict
- Risk score
- Detection signals

This makes the verification result shareable and easier to review outside the app.

### `react.jsx`

This file is the frontend UI.

It provides two simple views:

- `Verify`
  Upload a file, choose an asset type, run the verification, and see the result.

- `History`
  Fetch prior verifications for `demo_org` and download reports.

The frontend talks directly to `http://localhost:8000`.

### `demo.py`

This file is a Firestore seeding script.

It inserts sample verification records into the `verifications` collection so the history page has data to display.

Important note:

- `demo.py` currently expects the Firebase key path environment variable or defaults to `serviceAccountKey.json`
- `main.py` defaults to `firebasekey.json`

That naming mismatch is worth cleaning up if you want a smoother onboarding flow.

### `requirements.txt`

This file lists the Python dependencies used by the backend. Each package supports a specific part of the system.

## Why these imports are used

This section explains the major imports in plain English.

### Imports in `main.py`

- `os`
  Used for environment variables, file extensions, path building, and cleanup checks.

- `shutil`
  Used to copy uploaded file streams into temporary files.

- `uuid`
  Used to generate unique file names and local verification IDs.

- `datetime`
  Used to timestamp verification results.

- `FastAPI`, `File`, `Form`, `HTTPException`, `Query`, `UploadFile`
  These are FastAPI primitives for building API endpoints, receiving form data, handling uploads, parsing query parameters, and returning validation-friendly errors.

- `CORSMiddleware`
  Allows the browser frontend to call the backend from another origin.

- `FileResponse`
  Sends generated PDFs back to the client as downloadable files.

- `firebase_admin`, `credentials`, `firestore`
  Used only for Firebase persistence. `credentials` loads the service account key, and `firestore` creates the database client.

- `generate_report`
  Imported from `report.py` so the backend can build a PDF for a stored verification.

### Imports in `detector.py`

- `os`
  Used for environment variables such as `IMAGE_MODEL_PATH`, `MODEL_PROBABILITY_INDEX`, and `VIDEO_MAX_FRAMES`.

- `re`
  Used for document text parsing and normalization with regular expressions.

- `Counter`
  Helps count repeated words and repeated phrases in document analysis.

- `lru_cache`
  Prevents the ML model from being loaded repeatedly on every request.

- `cv2`
  OpenCV is used for image math and video processing, including grayscale conversion, blurring, DCT transforms, and frame sampling.

- `numpy`
  Used for numeric operations, arrays, averages, standard deviations, and model input preparation.

- `PIL.Image`, `PIL.ExifTags`, `UnidentifiedImageError`
  Pillow is used to load images, resize them, read EXIF metadata, and safely handle unsupported image files.

- `tensorflow.keras.models.load_model`
  Imported lazily inside `load_model()` so the app only tries to load the ML model when needed.

### Imports in `report.py`

- `reportlab.lib.colors`
  Used to color status and risk-score elements in the PDF.

- `reportlab.lib.pagesizes.A4`
  Defines the PDF page size.

- `reportlab.pdfgen.canvas`
  Provides the drawing API used to render the PDF.

### Imports in `react.jsx`

- `React`
  Required to define the component.

- `useEffect`
  Used to fetch verification history when the user switches to the history tab.

- `useState`
  Used to store UI state such as the selected file, loading state, verification result, and history records.

## Dependencies explained

The backend dependencies from `requirements.txt` are:

- `deepface`
  Present as a face-analysis dependency, though the current `detector.py` implementation does not directly call it right now.

- `fastapi`
  The web framework used to build the backend API.

- `firebase-admin`
  The Firebase Admin SDK, used for Firestore access.

- `numpy`
  Numeric foundation for the detector.

- `opencv-python`
  Used for image processing and video frame handling.

- `pillow`
  Used for image loading and metadata extraction.

- `python-multipart`
  Required by FastAPI to parse file uploads from multipart form requests.

- `reportlab`
  Used to generate PDF reports.

- `tf-keras`
  Supports loading TensorFlow / Keras image models.

- `uvicorn`
  The ASGI server used to run the FastAPI app.

## Environment variables

The project supports several environment variables.

### Backend persistence

- `FIREBASE_KEY_PATH`
  Path to the Firebase service account JSON file.
  Default in `main.py`: `firebasekey.json`

### Image model configuration

- `IMAGE_MODEL_PATH`
  Path to a saved Keras model used for image prediction.

- `MODEL_PROBABILITY_INDEX`
  Which output index to use if the model returns multiple values.
  Default: `1`

- `MODEL_HIGH_VALUE_LABEL`
  Defines whether a larger model output means `"fake"` or `"real"`.
  Allowed values: `fake`, `real`
  Default: `fake`

### Video processing

- `VIDEO_MAX_FRAMES`
  Maximum number of frames to sample from a video.
  Default: `12`

## Firebase optional mode

The backend now supports a safe local fallback mode.

If one of these is true:

- `firebase-admin` is not installed
- `firebasekey.json` does not exist
- Firebase initialization fails

then the app does not crash. Instead it:

- Prints a message saying Firebase is disabled
- Uses an in-memory dictionary called `local_verifications`
- Continues serving API requests locally

Limitations of this mode:

- Verification history disappears when the backend restarts
- Reports only work for results created during the current process lifetime
- No shared persistence across machines or deployments

## Setup and run

### 1. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv myenv
.\myenv\Scripts\Activate.ps1
```

Linux / macOS:

```bash
python -m venv myenv
source myenv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

Note:

- Some packages are large and may take time to install
- `opencv-python`, `tensorflow`-related packages, and Firebase packages can be the most noticeable

### 3. Optional Firebase setup

If you want persistent verification history:

1. Create or use a Firebase project
2. Enable Cloud Firestore
3. Download a service account JSON key
4. Put it in the project root as `firebasekey.json`

Or set:

```bash
FIREBASE_KEY_PATH=/path/to/your/key.json
```

If you skip this, the app still runs in local mode.

### 4. Optional model setup

If you want image predictions from a trained model instead of heuristic-only fallback:

```bash
IMAGE_MODEL_PATH=/path/to/model.h5
MODEL_PROBABILITY_INDEX=1
MODEL_HIGH_VALUE_LABEL=fake
```

If you skip model setup, the detector still runs, but with lower reliability for image and video predictions.

### 5. Start the API

```bash
python main.py
```

The backend runs on:

```text
http://127.0.0.1:8000
```

### 6. Smoke test the backend

```bash
curl http://127.0.0.1:8000/api/ping
```

Expected response:

```json
{"status":"ok"}
```

## Example API usage

### Verify an image

```bash
curl -X POST "http://127.0.0.1:8000/api/verify" \
  -F "file=@gg.jpeg" \
  -F "asset_type=image" \
  -F "candidate_id=test_candidate" \
  -F "org_id=demo_org"
```

### Get verification history

```bash
curl "http://127.0.0.1:8000/api/verifications?org_id=demo_org"
```

### Download a report

```bash
curl -O "http://127.0.0.1:8000/api/report/YOUR_VERIFICATION_ID"
```

## Frontend behavior

The frontend in `react.jsx` expects the backend at:

```text
http://localhost:8000
```

Frontend features:

- File upload
- Asset type selection
- Candidate ID input
- Verification result display
- History table
- Report download button

Important limitation:

- The current upload UI only allows `video` and `photo` as choices, even though the backend also supports `image` and `document`

So the backend is a little more capable than the current UI exposes.

## Current limitations and design notes

- The project uses `/tmp/...` paths in `main.py` and `report.py`
  This is Unix-style and may need adjustment for Windows environments. A future improvement would be to switch to Python's `tempfile` module.

- `deepface` is in `requirements.txt` but not actively used in the current detector code
  That suggests either planned functionality or a leftover dependency.

- `demo.py` assumes Firebase and does not yet use the same safe optional mode as `main.py`

- The document detector is heuristic-based and should not be treated as a high-confidence production classifier

- Local mode persistence is temporary by design

## If you want to improve the project next

Good next steps would be:

- Unify Firebase key naming between `main.py` and `demo.py`
- Replace `/tmp` with `tempfile.gettempdir()`
- Document or remove unused dependencies like `deepface`
- Add proper automated tests
- Expand the frontend to support document uploads
- Add a stronger document-analysis model or external provider

## Summary

VerifyMe is a prototype verification platform with:

- A FastAPI backend
- Heuristic and optional ML-based detection logic
- Optional Firebase persistence
- A React frontend
- PDF report generation

Firebase is used for storage, not analysis.
The detector is where the verification logic lives.
The frontend is a lightweight interface for interacting with the API.
The project can now run even without Firebase, which makes local development much easier.
