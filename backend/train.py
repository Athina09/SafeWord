"""Train the XGBoost risk model and tune low/medium/high thresholds (M9).

Run after data/generate.py:  python backend/train.py
Thresholds are tuned on a validation split of train.csv; test.csv stays untouched for metrics.py.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split

from app.features import FEATURES

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "models"

MAX_FALSE_HOLD = 0.005  # at most 0.5% of genuine payments held
MAX_FALSE_PROMPT = 0.04  # at most 4% of genuine payments get a voice prompt


def tune(prob: np.ndarray, y: np.ndarray) -> dict:
    genuine = prob[y == 0]
    # Synthetic classes separate almost perfectly, so quantiles alone collapse to ~0; floor them so
    # "medium" and "high" still mean medium and high probability of fraud.
    hold = max(float(np.quantile(genuine, 1 - MAX_FALSE_HOLD)), 0.6)
    prompt = min(max(float(np.quantile(genuine, 1 - MAX_FALSE_PROMPT)), 0.25), hold - 0.15)
    return {"prompt": round(prompt, 4), "hold": round(hold, 4)}


def main():
    df = pd.read_csv(ROOT / "data" / "train.csv")
    tr, val = train_test_split(df, test_size=0.2, stratify=df["label"], random_state=7)
    model = xgb.XGBClassifier(
        n_estimators=250, max_depth=4, learning_rate=0.08, subsample=0.9, colsample_bytree=0.9,
        eval_metric="logloss", random_state=7,
    )
    model.fit(tr[FEATURES], tr["label"])
    thresholds = tune(model.predict_proba(val[FEATURES])[:, 1], val["label"].to_numpy())

    OUT.mkdir(exist_ok=True)
    model.save_model(OUT / "risk.json")
    (OUT / "thresholds.json").write_text(json.dumps(thresholds, indent=2))
    print("saved model, thresholds:", thresholds)


if __name__ == "__main__":
    main()
