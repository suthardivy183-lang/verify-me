"""Scaffold the training-sample directory and tell the user what to put in it.

The stacking pipeline expects a folder layout under backend/samples/:
    samples/real/  — authentic camera photos (jpg/png)
    samples/ai/    — AI-generated / diffusion-model images

This script just creates the folders and prints next steps. Image collection
is intentionally manual: bundling a downloader for "real face" datasets pulls
in licensing and rate-limit concerns we don't want hidden inside a script.

Suggested sources (all manual download):
  Real:
    - FFHQ thumbnails       https://github.com/NVlabs/ffhq-dataset
    - Flickr-Faces-HQ subset on Kaggle
    - Your own camera photos
  AI:
    - https://thispersondoesnotexist.com (right-click save, repeat)
    - Stable Diffusion / SDXL outputs
    - Midjourney exports
"""

from __future__ import annotations

import os
import sys


SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    samples_dir = os.path.join(here, "samples")
    real_dir = os.path.join(samples_dir, "real")
    ai_dir = os.path.join(samples_dir, "ai")

    for d in (real_dir, ai_dir):
        os.makedirs(d, exist_ok=True)

    real_n = sum(1 for f in os.listdir(real_dir) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS)
    ai_n = sum(1 for f in os.listdir(ai_dir) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS)

    print(f"samples/real/  →  {real_n} image(s)")
    print(f"samples/ai/    →  {ai_n} image(s)")

    if real_n == 0 or ai_n == 0:
        print()
        print("Both folders need images before you can train the stacker.")
        print("Aim for at least 50 of each (more is better).")
        print()
        print("Suggested sources:")
        print("  Real:  FFHQ, your own camera photos, Unsplash camera-tagged shots")
        print("  AI :   thispersondoesnotexist.com, SDXL/Midjourney outputs")
        print()
        print("After collecting:")
        print("  python backend/compute_clip_centroids.py")
        print("  python backend/build_dataset.py --out backend/dataset.csv")
        print("  python backend/train_stacking.py backend/dataset.csv")
        return 1

    print()
    print("Folders look populated. Next:")
    print("  python backend/compute_clip_centroids.py")
    print("  python backend/build_dataset.py --out backend/dataset.csv")
    print("  python backend/train_stacking.py backend/dataset.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
