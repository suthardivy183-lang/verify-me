import os
import uuid
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore


cred = credentials.Certificate(os.getenv("FIREBASE_KEY_PATH", "serviceAccountKey.json"))
firebase_admin.initialize_app(cred)
db = firestore.client()


def main():
    timestamp = datetime.utcnow().isoformat()
    records = [
        {
            "candidate_id": "candidate_amit_sharma",
            "asset_type": "video",
            "risk_score": 84,
            "verdict": "LIKELY FAKE",
            "signals": {
                "avg_face_confidence": 0.42,
                "face_confidence_std": 0.31,
                "avg_temporal_flicker": 23.8,
            },
        },
        {
            "candidate_id": "candidate_priya_k",
            "asset_type": "photo",
            "risk_score": 71,
            "verdict": "LIKELY FAKE",
            "signals": {
                "noise": 1.7,
                "dct_high_freq_energy": 0.0007,
                "saturation_std": 24.2,
            },
        },
        {
            "candidate_id": "candidate_rohan_mehta",
            "asset_type": "video",
            "risk_score": 67,
            "verdict": "LIKELY FAKE",
            "signals": {
                "avg_face_confidence": 0.58,
                "face_confidence_std": 0.24,
                "avg_temporal_flicker": 19.6,
            },
        },
        {
            "candidate_id": "candidate_neha_iyer",
            "asset_type": "photo",
            "risk_score": 12,
            "verdict": "LIKELY REAL",
            "signals": {
                "noise": 5.8,
                "dct_high_freq_energy": 0.0042,
                "saturation_std": 47.9,
            },
        },
        {
            "candidate_id": "candidate_arjun_patel",
            "asset_type": "video",
            "risk_score": 28,
            "verdict": "LIKELY REAL",
            "signals": {
                "avg_face_confidence": 0.88,
                "face_confidence_std": 0.08,
                "avg_temporal_flicker": 11.3,
            },
        },
        {
            "candidate_id": "candidate_sana_q",
            "asset_type": "document",
            "risk_score": 7,
            "verdict": "LIKELY REAL",
            "signals": {
                "noise": 6.1,
                "dct_high_freq_energy": 0.0051,
                "saturation_std": 52.4,
            },
        },
    ]

    for record in records:
        verification_id = str(uuid.uuid4())
        document = {
            "verification_id": verification_id,
            "candidate_id": record["candidate_id"],
            "org_id": "demo_org",
            "asset_type": record["asset_type"],
            "risk_score": record["risk_score"],
            "verdict": record["verdict"],
            "signals": record["signals"],
            "timestamp": timestamp,
            "pdf_path": "",
        }
        db.collection("verifications").document(verification_id).set(document)

    print(f"Seeded {len(records)} documents")


if __name__ == "__main__":
    main()