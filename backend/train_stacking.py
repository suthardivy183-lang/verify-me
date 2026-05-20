"""Fit a calibrated stacking classifier on top of detector signals.

Input CSV columns (order does not matter, names must match):
    efficientnet_prob, sdxl_prob, fft_score, clip_score, label

`label` is 0 (real) or 1 (fake). Output: pickled scikit-learn estimator with
`predict_proba`, callable as `model.predict_proba([[eff, sdxl, fft, clip]])`
and returning P(fake) at column index 1.

Usage:
    python backend/train_stacking.py data.csv --out backend/stacking_model.pkl
"""

from __future__ import annotations

import argparse
import os
import pickle
import sys

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS = ("efficientnet_prob", "sdxl_prob", "fft_score", "clip_score")
LABEL_COLUMN = "label"


def load_dataset(csv_path: str) -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_csv(csv_path)
    missing = [c for c in (*FEATURE_COLUMNS, LABEL_COLUMN) if c not in df.columns]
    if missing:
        raise SystemExit(f"CSV is missing required columns: {missing}")
    X = df[list(FEATURE_COLUMNS)].to_numpy(dtype=np.float32)
    y = df[LABEL_COLUMN].to_numpy(dtype=np.int32)
    if not set(np.unique(y)).issubset({0, 1}):
        raise SystemExit("`label` column must contain only 0 and 1")
    if len(y) < 20:
        raise SystemExit(f"Need at least 20 rows to train; got {len(y)}")
    return X, y


def fit_stacker(X: np.ndarray, y: np.ndarray, cv_folds: int) -> CalibratedClassifierCV:
    base = LogisticRegression(max_iter=1000, C=1.0)
    folds = max(2, min(cv_folds, np.bincount(y).min()))
    return CalibratedClassifierCV(base, method="sigmoid", cv=folds).fit(X, y)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", help="Training CSV path")
    parser.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "stacking_model.pkl"),
        help="Output pickle path",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--cv", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    X, y = load_dataset(args.csv)
    print(f"Loaded {len(y)} rows from {args.csv} ({int(y.sum())} fake / {int(len(y) - y.sum())} real)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y,
    )
    model = fit_stacker(X_train, y_train, args.cv)

    train_probs = model.predict_proba(X_train)[:, 1]
    test_probs = model.predict_proba(X_test)[:, 1]
    print(f"Train AUC: {roc_auc_score(y_train, train_probs):.4f}  log-loss: {log_loss(y_train, train_probs):.4f}")
    print(f"Test  AUC: {roc_auc_score(y_test, test_probs):.4f}  log-loss: {log_loss(y_test, test_probs):.4f}")

    with open(args.out, "wb") as fh:
        pickle.dump(model, fh)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    sys.exit(main())
