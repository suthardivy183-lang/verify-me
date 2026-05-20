"""Compute and save CLIP image-embedding centroids for real vs AI samples.

Reads images from backend/samples/real and backend/samples/ai, pushes each
through the same CLIP model used at inference time (load_model() in
detector.py), L2-normalises every embedding, takes the per-class mean,
re-normalises, and writes backend/clip_centroids.npz with keys
`real_centroid` and `ai_centroid`.

Usage:
    python backend/compute_clip_centroids.py
    python backend/compute_clip_centroids.py --samples backend/samples --out backend/clip_centroids.npz
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
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


def class_centroid(paths: list[str], embed_fn) -> np.ndarray:
    embeddings = []
    for path in paths:
        try:
            img = Image.open(path).convert("RGB")
        except Exception as exc:
            print(f"  skip {path}: {exc}")
            continue
        emb = embed_fn(img)
        if emb is None:
            print(f"  skip {path}: CLIP returned None")
            continue
        embeddings.append(emb)
    if not embeddings:
        raise SystemExit("No usable embeddings produced — is CLIP loading correctly?")
    stacked = np.stack(embeddings, axis=0).astype(np.float32)
    centroid = stacked.mean(axis=0)
    centroid = centroid / (np.linalg.norm(centroid) + 1e-9)
    return centroid


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", default=os.path.join(here, "samples"))
    parser.add_argument("--out", default=os.path.join(here, "clip_centroids.npz"))
    args = parser.parse_args()

    if here not in sys.path:
        sys.path.insert(0, here)
    from detector import _clip_image_embedding

    real_paths = list_images(os.path.join(args.samples, "real"))
    ai_paths = list_images(os.path.join(args.samples, "ai"))
    print(f"real samples: {len(real_paths)}")
    print(f"ai   samples: {len(ai_paths)}")
    if not real_paths or not ai_paths:
        raise SystemExit("Need at least one image in each of samples/real and samples/ai")

    print("Embedding real…")
    real_c = class_centroid(real_paths, _clip_image_embedding)
    print("Embedding ai…")
    ai_c = class_centroid(ai_paths, _clip_image_embedding)

    np.savez(args.out, real_centroid=real_c, ai_centroid=ai_c)
    print(f"Wrote {args.out}  (dim={real_c.shape[0]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
