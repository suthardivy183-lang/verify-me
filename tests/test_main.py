import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from main import app, MAX_IMAGE_UPLOAD_BYTES

client = TestClient(app)

# The /scan endpoint calls analyze_image() then returns result.get("explanation")
# so the mock must nest the payload under "explanation"
MOCK_RESULT = {
    "explanation": {
        "verdict": "Asli",
        "confidence_pct": 99,
        "explanation_en": "Looks authentic.",
        "explanation_local": "असली लगती है।",
        "red_flags": [],
        "learn_more_tip": "Verify the source.",
        "source": "mock",
        "cache_hit": False,
    }
}


def test_scan_file_too_large():
    large = b"a" * (MAX_IMAGE_UPLOAD_BYTES + 1)
    resp = client.post("/scan", files={"image": ("big.jpg", large, "image/jpeg")})
    assert resp.status_code == 413
    assert "too large" in resp.json()["detail"].lower()


def test_scan_invalid_mime_type():
    resp = client.post("/scan", files={"image": ("doc.txt", b"not an image", "text/plain")})
    assert resp.status_code == 400
    assert "unsupported" in resp.json()["detail"].lower()


def test_scan_empty_upload():
    resp = client.post("/scan", files={"image": ("empty.jpg", b"", "image/jpeg")})
    assert resp.status_code == 400


def test_scan_happy_path():
    # main.py does `from detector import analyze_image` inline, so patch at source
    with patch("detector.analyze_image", return_value=MOCK_RESULT) as mock_fn:
        small = b"fake_jpeg_data"
        resp = client.post(
            "/scan",
            files={"image": ("photo.jpeg", small, "image/jpeg")},
            data={"target_language": "en"},
        )
    assert resp.status_code == 200
    assert resp.json()["verdict"] == "Asli"
