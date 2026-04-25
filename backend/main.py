import os
import shutil
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.report import generate_report

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


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/verify")
async def verify(
    file: UploadFile = File(...),
    asset_type: str = Form(...),
    candidate_id: str = Form(""),
    org_id: str = Form("demo_org"),
):
    extension = os.path.splitext(file.filename or "")[1]
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{extension}")

    try:
        with open(tmp_path, "wb") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)

        from backend.detector import analyze_document, analyze_image, analyze_video

        try:
            normalized_asset_type = asset_type.strip().lower()

            if normalized_asset_type == "video":
                result = analyze_video(tmp_path)
            elif normalized_asset_type in {"image", "photo"}:
                result = analyze_image(tmp_path)
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
            "asset_type": result["type"],
            "candidate_id": candidate_id,
        }
    finally:
        file.file.close()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/api/verifications")
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


@app.get("/api/report/{verification_id}")
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


@app.get("/api/ping")
async def ping():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
