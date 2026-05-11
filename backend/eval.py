#!/usr/bin/env python3
"""
Accuracy evaluation on the 25-image testset via the live /scan API.

Usage:
    python backend/eval.py                     # hits localhost:8000
    python backend/eval.py --api http://host   # custom API URL
    python backend/eval.py --quiet             # summary only
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _is_valid_image(path: str) -> bool:
    with open(path, "rb") as f:
        header = f.read(16)
    # JPEG: FF D8 FF  |  PNG: 89 50 4E 47
    return header[:3] == b'\xff\xd8\xff' or header[:4] == b'\x89PNG'


def build_ground_truth(testset_dir: Path) -> dict:
    """
    Returns {absolute_path: "REAL" or "FAKE"} for valid images only.
    Skips files that are not real JPEG/PNG (e.g. broken HTML downloads).

    FOLDER NAME IS AUTHORITATIVE (from CLAUDE.md):
      ai_fixed/    = 8 confirmed AI-generated images  → FAKE
      real_fixed/  = 11 confirmed real photos          → REAL
      real/        = 6 real photos                     → REAL
    The file prefixes (ai_ds_*, real_ds_*) are original dataset names and
    do NOT indicate ground-truth label.
    """
    gt = {}
    for f in sorted((testset_dir / "real").glob("*.jpg")):
        if _is_valid_image(str(f)):
            gt[str(f)] = "REAL"
    for f in sorted((testset_dir / "ai_fixed").glob("*.jpg")):
        if _is_valid_image(str(f)):
            gt[str(f)] = "FAKE"
    for f in sorted((testset_dir / "real_fixed").glob("*.jpg")):
        if _is_valid_image(str(f)):
            gt[str(f)] = "REAL"   # entire real_fixed/ folder = confirmed real photos
    return gt


def scan_image(api_base: str, img_path: str) -> dict:
    """POST image to /scan and return the JSON response."""
    boundary = uuid.uuid4().hex
    with open(img_path, "rb") as fh:
        image_bytes = fh.read()

    filename = Path(img_path).name
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + image_bytes + (
        f"\r\n--{boundary}\r\n"
        f'Content-Disposition: form-data; name="target_language"\r\n\r\nen'
        f"\r\n--{boundary}--\r\n"
    ).encode()

    req = urllib.request.Request(
        f"{api_base}/scan",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as resp:
        return json.loads(resp.read())


def verdict_from_result(result: dict) -> str:
    # /scan returns explainer verdict: "Nakli"=FAKE, "Asli"=REAL, "Shak hai"=UNCERTAIN
    verdict = str(result.get("verdict", "")).strip().lower()
    if verdict == "nakli":
        return "FAKE"
    if verdict == "asli":
        return "REAL"
    # fallback: check prediction field (legacy /api/verify format)
    pred = str(result.get("prediction", "")).strip().lower()
    if "fake" in pred:
        return "FAKE"
    if "real" in pred:
        return "REAL"
    return "UNCERTAIN"


def run_eval(testset_dir: Path, api_base: str = "http://localhost:8000", quiet: bool = False):
    ground_truth = build_ground_truth(testset_dir)
    n = len(ground_truth)
    if n != 25:
        print(f"WARNING: Expected 25 images, found {n}")

    rows = []
    for i, (img_path, label) in enumerate(sorted(ground_truth.items())):
        name = Path(img_path).name
        if not quiet:
            print(f"  {name:35s} ...", end=" ", flush=True)
        if i > 0:
            time.sleep(3)  # avoid Gemini 429 rate limit
        try:
            result = scan_image(api_base, img_path)
            predicted = verdict_from_result(result)
            # /scan response: confidence_pct tells us how sure it is
            conf = result.get("confidence_pct", -1)
            verdict = result.get("verdict", "")
            if verdict == "Nakli":
                fake_prob = conf / 100.0 if conf > 0 else 0.75
            elif verdict == "Asli":
                fake_prob = 1.0 - conf / 100.0 if conf > 0 else 0.25
            else:
                fake_prob = result.get("signals", {}).get("fake_score",
                            result.get("details", {}).get("fake_probability", 0.5))

            if not quiet:
                status = "OK" if predicted == label else ("ABST" if predicted == "UNCERTAIN" else "WRONG")
                print(f"[{status}]  label={label:4s}  pred={predicted:9s}  p={float(fake_prob):.3f}")

            rows.append({
                "name": name, "label": label, "predicted": predicted,
                "fake_prob": float(fake_prob), "correct": predicted == label,
                "abstained": predicted == "UNCERTAIN", "error": False,
            })
        except Exception as exc:
            if not quiet:
                print(f"[ERR]  {exc}")
            rows.append({
                "name": name, "label": label, "predicted": "ERROR",
                "fake_prob": -1.0, "correct": False, "abstained": False, "error": True,
            })

    decided   = [r for r in rows if not r["abstained"] and not r["error"]]
    correct   = sum(1 for r in decided if r["correct"])
    abstained = sum(1 for r in rows if r["abstained"])
    errors    = sum(1 for r in rows if r["error"])

    accuracy = correct / len(decided) if decided else 0.0
    coverage = len(decided) / n if n else 0.0

    real_d = [r for r in decided if r["label"] == "REAL"]
    fake_d = [r for r in decided if r["label"] == "FAKE"]
    tp = sum(1 for r in fake_d if r["predicted"] == "FAKE")
    fp = sum(1 for r in real_d if r["predicted"] == "FAKE")
    tn = sum(1 for r in real_d if r["predicted"] == "REAL")
    fn = sum(1 for r in fake_d if r["predicted"] == "REAL")

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    print()
    print("=" * 58)
    print(f"EVAL  (n={n}  decided={len(decided)}  abstained={abstained}  errors={errors})")
    print("=" * 58)
    print(f"  Accuracy  : {accuracy*100:5.1f}%  ({correct}/{len(decided)} decided)")
    print(f"  Coverage  : {coverage*100:5.1f}%  ({len(decided)}/{n})")
    print(f"  Precision : {precision:.3f}")
    print(f"  Recall    : {recall:.3f}")
    print(f"  F1        : {f1:.3f}")
    print(f"  TP/FP/TN/FN: {tp}/{fp}/{tn}/{fn}")
    print()

    return {"accuracy": accuracy, "coverage": coverage, "f1": f1,
            "precision": precision, "recall": recall,
            "tp": tp, "fp": fp, "tn": tn, "fn": fn}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    testset_dir = REPO_ROOT / "testset"
    if not testset_dir.exists():
        print(f"ERROR: testset not found at {testset_dir}")
        sys.exit(1)

    print(f"Evaluating against {args.api} ...")
    run_eval(testset_dir, api_base=args.api)
