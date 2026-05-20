"""Build the stacking-classifier training CSV by running every detector
component on each sample image.

Walks backend/samples/real (label=0) and backend/samples/ai (label=1),
runs predict_with_efficientnet, predict_with_sdxl_detector, _radial_fft_score,
and _clip_centroid_score on every image, and writes one row per image.

Output schema (matches what train_stacking.py reads):
    path,label,efficientnet_prob,sdxl_prob,fft_score,clip_score

Usage:
    python backend/build_dataset.py --out backend/dataset.csv
    python backend/build_dataset.py --samples backend/samples --out backend/dataset.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

from PIL import Image


SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def list_images(folder: str) -> list[str]:
    if not os.path.isdir(folder):
        return []
    return sorted(
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS
    )


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", default=os.path.join(here, "samples"))
    parser.add_argument("--out", default=os.path.join(here, "dataset.csv"))
    args = parser.parse_args()

    if here not in sys.path:
        sys.path.insert(0, here)
    from detector import (
        _clip_centroid_score,
        _radial_fft_score,
        predict_with_efficientnet,
        predict_with_sdxl_detector,
    )

    classes = [("real", 0), ("ai", 1)]
    rows = []
    for class_name, label in classes:
        folder = os.path.join(args.samples, class_name)
        paths = list_images(folder)
        print(f"{class_name}: {len(paths)} image(s)")
        for path in paths:
            try:
                img = Image.open(path).convert("RGB")
            except Exception as exc:
                print(f"  skip {path}: {exc}")
                continue

            eff = predict_with_efficientnet(img).get("fake_probability")
            sdxl = predict_with_sdxl_detector(img).get("fake_probability")
            fft = _radial_fft_score(img)
            clip = _clip_centroid_score(img)

            if eff is None or sdxl is None:
                print(f"  skip {path}: a base model returned no probability")
                continue

            rows.append({
                "path": path,
                "label": label,
                "efficientnet_prob": float(eff),
                "sdxl_prob": float(sdxl),
                "fft_score": float(fft),
                "clip_score": float(clip),
            })
            print(f"  {os.path.basename(path)}  eff={eff:.3f} sdxl={sdxl:.3f} fft={fft:.3f} clip={clip:.3f}")

    if not rows:
        raise SystemExit("No usable samples — populate backend/samples/real and backend/samples/ai first.")

    fieldnames = ["path", "label", "efficientnet_prob", "sdxl_prob", "fft_score", "clip_score"]
    with open(args.out, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} rows to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
