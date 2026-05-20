import contextvars
import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import io

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv

from report import generate_report

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

APP_VERSION = "0.2.0"
START_TIME = time.time()
MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


# ───────────────────────── Firebase init ─────────────────────────

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_enabled = True
except ImportError:
    firebase_admin = None
    credentials = None
    firestore = None
    firebase_enabled = False


local_verifications = {}
BASE_DIR = Path(__file__).resolve().parent

if firebase_enabled:
    try:
        default_key_path = BASE_DIR / "firebasekey.json"
        cred = credentials.Certificate(os.getenv("FIREBASE_KEY_PATH", str(default_key_path)))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
    except Exception as exc:
        firebase_enabled = False
        db = None
        print(f"Firebase disabled - running locally ({exc})")
    else:
        print("Firebase enabled")
else:
    db = None
    print("Firebase disabled - running locally")


# ───────────────────────── FastAPI app + OpenAPI metadata ─────────────────────────

app = FastAPI(
    title="Asli API",
    description=(
        "Multilingual AI-content authenticity verification.\n\n"
        "Detects AI-generated and manipulated images, then explains the verdict "
        "in plain language across English, Hindi, and Gujarati. Built for the "
        "Google Solution Challenge 2026."
    ),
    version=APP_VERSION,
    contact={"name": "Asli Team"},
)


# ───────────────────────── CORS ─────────────────────────

# CORS policy:
#   - Dev default (ALLOWED_ORIGINS unset or "*"): permissive — allow any origin
#     including null (file:// loads) and any localhost port.
#   - Prod: set ALLOWED_ORIGINS to a comma-separated list of explicit origins,
#     or use ALLOWED_ORIGIN_REGEX for wildcard patterns like *.run.app.
env_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
env_regex = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip()

if not env_origins or env_origins == "*":
    cors_origins = ["*"]
    cors_origin_regex = None
    # When using "*", credentials cannot also be true per the CORS spec.
    cors_allow_credentials = False
else:
    cors_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    cors_origin_regex = env_regex or None
    cors_allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ───────────────────────── Model pre-warming on startup ─────────────────────────

@app.on_event("startup")
async def prewarm_models():
    """Load and warm up the EfficientNet model on backend startup so the first
    real request doesn't pay the cold-start cost (~60s on Mac CPU).
    Runs in a background thread so startup isn't blocked.
    """
    import threading
    import time as _time

    def _warm():
        try:
            from PIL import Image
            from detector import predict_with_efficientnet, predict_with_sdxl_detector
            dummy = Image.new("RGB", (224, 224), color=(128, 128, 128))
            t0 = _time.time()
            print("[prewarm] Loading EfficientNet...", flush=True)
            predict_with_efficientnet(dummy)
            print(f"[prewarm] EfficientNet ready in {_time.time()-t0:.1f}s", flush=True)
            t1 = _time.time()
            print("[prewarm] Loading SDXL detector...", flush=True)
            predict_with_sdxl_detector(dummy)
            print(f"[prewarm] SDXL detector ready in {_time.time()-t1:.1f}s", flush=True)
            print(f"[prewarm] All models ready in {_time.time()-t0:.1f}s", flush=True)
        except Exception as exc:
            print(f"[prewarm] Failed: {exc}", flush=True)

    threading.Thread(target=_warm, daemon=True).start()


# ───────────────────────── structured JSON logging middleware ─────────────────────────

# Per-request bag of extra fields handlers can populate (read by middleware on exit).
_log_extras: contextvars.ContextVar = contextvars.ContextVar("asli_log_extras", default=None)


def set_log_extras(**kwargs) -> None:
    """Handlers call this to enrich the access log entry for the current request."""
    bag = _log_extras.get()
    if bag is None:
        return
    bag.update({k: v for k, v in kwargs.items() if v is not None})


@app.middleware("http")
async def structured_logging_middleware(request: Request, call_next):
    bag: dict = {}
    token = _log_extras.set(bag)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        latency_ms = int((time.perf_counter() - start) * 1000)
        _log_extras.reset(token)

    log_entry = {
        "severity": "INFO",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "latency_ms": latency_ms,
        **bag,
    }
    print(json.dumps(log_entry, default=str), flush=True)
    return response


# ───────────────────────── /healthz (Cloud Run health check) ─────────────────────────

@app.get(
    "/healthz",
    summary="Liveness check for Cloud Run",
    response_description="Service status with version and uptime",
    tags=["meta"],
)
async def healthz():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "uptime_seconds": int(time.time() - START_TIME),
    }


# ───────────────────────── /scan (new structured endpoint) ─────────────────────────

_SCAN_EXAMPLE_RESPONSE = {
    "verdict": "Nakli",
    "confidence_pct": 88,
    "explanation_en": (
        "The image's skin texture is unnaturally smooth with no visible pores, "
        "and the earring shapes differ between left and right ears. Background "
        "depth-of-field is inconsistent. These artifacts, combined with the "
        "ensemble's high fake_probability, indicate an AI-generated image."
    ),
    "explanation_local": (
        "तस्वीर की त्वचा की बनावट अप्राकृतिक रूप से चिकनी है (pores नहीं दिख रहे), "
        "और दोनों कानों की earrings अलग-अलग हैं। पृष्ठभूमि की depth-of-field असंगत है। "
        "ये संकेत AI-जनित तस्वीर की पुष्टि करते हैं।"
    ),
    "red_flags": [
        "skin lacks visible pores",
        "earrings asymmetric between ears",
        "inconsistent background depth-of-field",
    ],
    "learn_more_tip": (
        "WhatsApp या social media से आई किसी भी तस्वीर पर भरोसा करने से पहले "
        "उसका स्रोत खोजें (Google reverse image search) और चेहरे/हाथों की बारीक डिटेल पर ध्यान दें।"
    ),
    "source": "gemini",
    "cache_hit": False,
}


@app.post(
    "/scan",
    summary="Verify an image and return a multilingual explanation",
    description=(
        "Analyzes an uploaded image with a 3-model ensemble + heuristics, then "
        "uses Gemini (with a deterministic template fallback) to produce a plain-"
        "language explanation in English plus the requested target language. "
        "Stateless — does not write to Firestore."
    ),
    tags=["scan"],
    responses={
        200: {
            "description": "Structured verdict + multilingual explanation",
            "content": {"application/json": {"example": _SCAN_EXAMPLE_RESPONSE}},
        },
        400: {"description": "Invalid image or unsupported language"},
        413: {"description": "Image file too large"}, # Added for payload too large
        500: {"description": "Internal analysis error"},
    },
)
async def scan(
    image: UploadFile = File(..., description="Image file (JPEG/PNG)"),
    target_language: str = Form("hi", description="Output language: 'hi' | 'gu' | 'en'"),
    user_context: str = Form(None, description='Optional context, e.g. "received via WhatsApp"'),
):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=400, detail="Unsupported image type. Only JPEG and PNG are allowed.")

    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")
    
    if len(raw_bytes) > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Image file too large. Max size is {MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024):.0f}MB.")

    image_hash_full = hashlib.sha256(raw_bytes).hexdigest()
    image_hash = image_hash_full[:12]

    normalized_language = (target_language or "hi").strip().lower()
    if normalized_language not in {"hi", "gu", "en"}:
        normalized_language = "hi"

    extension = os.path.splitext(image.filename or "")[1] or ".jpg"
    tmp_path = os.path.join(tempfile.gettempdir(), f"scan_{uuid.uuid4().hex}{extension}")

    try:
        with open(tmp_path, "wb") as fh:
            fh.write(raw_bytes)

        from detector import analyze_image

        try:
            result = analyze_image(tmp_path, target_language=normalized_language)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        explanation = result.get("explanation") or {}
        if user_context:
            explanation["user_context"] = user_context.strip()[:500]

        set_log_extras(
            image_hash=image_hash,
            verdict=explanation.get("verdict"),
            cache_hit=bool(explanation.get("cache_hit")),
            gemini_used=(explanation.get("source") == "gemini"),
            target_language=normalized_language,
            has_user_context=bool(user_context),
        )

        return JSONResponse(content=explanation)
    finally:
        try:
            await image.close()
        except Exception:
            pass
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ───────────────────────── legacy /api/verify (deprecated) ─────────────────────────

@app.post(
    "/api/verify",
    summary="Legacy verification endpoint (deprecated, use /scan)",
    deprecated=True,
    tags=["legacy"],
)
async def verify(
    response: Response,
    file: UploadFile = File(...),
    asset_type: str = Form(...),
    candidate_id: str = Form(""),
    org_id: str = Form("demo_org"),
    target_language: str = Form("hi"),
):
    response.headers["X-Deprecated"] = "Use /scan instead"

    extension = os.path.splitext(file.filename or "")[1]
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{extension}")

    try:
        with open(tmp_path, "wb") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)

        from detector import analyze_document, analyze_image, analyze_video

        try:
            normalized_asset_type = asset_type.strip().lower()
            normalized_language = (target_language or "hi").strip().lower()
            if normalized_language not in {"hi", "gu", "en"}:
                normalized_language = "hi"

            if normalized_asset_type == "video":
                result = analyze_video(tmp_path)
            elif normalized_asset_type in {"image", "photo"}:
                result = analyze_image(tmp_path, target_language=normalized_language)
            elif normalized_asset_type == "document":
                result = analyze_document(tmp_path)
            else:
                raise HTTPException(
                    status_code=400,
                    detail='asset_type must be "image", "photo", "document", or "video"',
                )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        timestamp = datetime.utcnow().isoformat()
        document = {
            **result,
            "asset_type": result["type"],
            "candidate_id": candidate_id,
            "org_id": org_id,
            "timestamp": timestamp,
        }
        if firebase_enabled:
            doc_ref = db.collection("verifications").document()
            doc_ref.set(document)
            verification_id = doc_ref.id
        else:
            verification_id = uuid.uuid4().hex
            local_verifications[verification_id] = document

        explanation = result.get("explanation") or {}
        set_log_extras(
            verdict=explanation.get("verdict"),
            cache_hit=bool(explanation.get("cache_hit")),
            gemini_used=(explanation.get("source") == "gemini"),
            target_language=normalized_language,
            asset_type=result["type"],
        )

        return {
            "verification_id": verification_id,
            "type": result["type"],
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "source": result["source"],
            "model_loaded": result["model_loaded"],
            "reliability_score": result["reliability_score"],
            "metadata_status": result["metadata_status"],
            "risk_level": result["risk_level"],
            "details": result["details"],
            "risk_score": result["risk_score"],
            "verdict": result["verdict"],
            "signals": result["signals"],
            "explanation": explanation,
            "asset_type": result["type"],
            "candidate_id": candidate_id,
        }
    finally:
        file.file.close()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/api/verifications", tags=["legacy"])
async def verifications(org_id: str = Query(...)):
    records = []

    if firebase_enabled:
        docs = db.collection("verifications").where("org_id", "==", org_id).stream()
        for doc in docs:
            record = doc.to_dict()
            record["verification_id"] = doc.id
            records.append(record)
    else:
        for verification_id, record in local_verifications.items():
            if record.get("org_id") != org_id:
                continue
            records.append({**record, "verification_id": verification_id})

    records.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return records[:50]


@app.get("/api/report/{verification_id}", tags=["legacy"])
async def report(verification_id: str):
    if firebase_enabled:
        doc = db.collection("verifications").document(verification_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Verification not found")
        data = doc.to_dict()
        data["verification_id"] = verification_id
    else:
        data = local_verifications.get(verification_id)
        if not data:
            raise HTTPException(status_code=404, detail="Verification not found")
        data = {**data, "verification_id": verification_id}

    file_path = generate_report(data)

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"{verification_id}.pdf",
    )


@app.get("/api/ping", tags=["legacy"])
async def ping():
    return {"status": "ok"}


# ───────────────────────── /scan-video ─────────────────────────

_ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}

@app.post("/scan-video", tags=["detection"])
async def scan_video(
    video: UploadFile = File(..., description="Video file (MP4/MOV/WebM/AVI)"),
    target_language: str = Form("hi", description="Output language: 'hi' | 'gu' | 'en'"),
):
    raw_bytes = await video.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty video upload")

    ext = os.path.splitext(video.filename or "")[1].lower() or ".mp4"
    if ext not in _ALLOWED_VIDEO_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported video format: {ext}")

    normalized_language = (target_language or "hi").strip().lower()
    if normalized_language not in {"hi", "gu", "en"}:
        normalized_language = "hi"

    tmp_path = os.path.join(tempfile.gettempdir(), f"scanvid_{uuid.uuid4().hex}{ext}")
    try:
        with open(tmp_path, "wb") as fh:
            fh.write(raw_bytes)

        from detector import analyze_video_fast
        import asyncio
        import functools

        try:
            # Run blocking PyTorch inference in a threadpool so it does NOT
            # freeze the event loop (single uvicorn worker would otherwise
            # be unable to accept any other request while inference runs).
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                functools.partial(
                    analyze_video_fast, tmp_path, target_language=normalized_language
                ),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        return JSONResponse(content=result)
    finally:
        try:
            await video.close()
        except Exception:
            pass
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ───────────────────────── /ws/live (WebSocket live detection) ──

@app.websocket("/ws/live")
async def live_detect(websocket: WebSocket):
    await websocket.accept()
    print("[ws/live] Client connected", flush=True)

    from detector import (
        predict_with_efficientnet,
        HIGH_FAKE_THRESHOLD,
        LOW_FAKE_THRESHOLD,
    )
    from PIL import Image as _PIL_Image
    import time as _time
    import asyncio

    loop = asyncio.get_event_loop()
    frame_num = 0
    try:
        while True:
            data = await websocket.receive_bytes()
            frame_num += 1
            t0 = _time.time()
            try:
                image = _PIL_Image.open(io.BytesIO(data)).convert("RGB")
            except Exception as exc:
                await websocket.send_json({"error": f"invalid image: {exc}"})
                continue

            # Lightweight: EfficientNet only, no Organika, no Gemini.
            # Run in threadpool so blocking inference doesn't freeze the
            # event loop (which would block /scan-video and other clients).
            try:
                eff_result = await loop.run_in_executor(
                    None, predict_with_efficientnet, image
                )
                fake_score = float(eff_result.get("fake_probability", 0.5))
            except Exception as exc:
                await websocket.send_json({"error": f"inference failed: {exc}"})
                continue

            if fake_score >= HIGH_FAKE_THRESHOLD:
                verdict = "Nakli"
            elif fake_score <= LOW_FAKE_THRESHOLD:
                verdict = "Asli"
            else:
                verdict = "Shak hai"

            confidence_pct = int(min(abs(fake_score - 0.5) * 200, 99))
            elapsed = _time.time() - t0

            print(f"[ws/live] Frame {frame_num}: {verdict} ({fake_score:.3f}) — {elapsed*1000:.0f}ms", flush=True)

            await websocket.send_json({
                "verdict":        verdict,
                "fake_score":     round(fake_score, 3),
                "confidence_pct": confidence_pct,
            })
    except WebSocketDisconnect:
        print(f"[ws/live] Client disconnected after {frame_num} frames", flush=True)
    except Exception as exc:
        print(f"[ws/live] Error: {exc}", flush=True)
        try:
            await websocket.send_json({"error": str(exc)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
