"""Risk engine (M9): XGBoost score plus SHAP-based plain-language reasons."""
import json
from pathlib import Path

import numpy as np
import shap
import xgboost as xgb

from .features import FEATURES, LABELS, REASONS, vector

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
MIN_SHAP = 0.15  # ignore contributions smaller than this (log-odds)
MAX_REASONS = 3


class RiskEngine:
    def __init__(self, model_dir: Path = MODEL_DIR):
        model_path = model_dir / "risk.json"
        if not model_path.exists():
            raise FileNotFoundError("No trained model. Run: python data/generate.py && python backend/train.py")
        self.model = xgb.XGBClassifier()
        self.model.load_model(model_path)
        self.thresholds = json.loads((model_dir / "thresholds.json").read_text())
        self.explainer = shap.TreeExplainer(self.model)

    def score(self, feats: dict) -> tuple[float, list[str], list[dict]]:
        x = np.array([vector(feats)])
        prob = float(self.model.predict_proba(x)[0, 1])
        contrib = np.asarray(self.explainer.shap_values(x)).reshape(-1)
        ranked = sorted(zip(FEATURES, contrib), key=lambda fc: -fc[1])
        reasons = [REASONS[f] for f, v in ranked if v > MIN_SHAP][:MAX_REASONS]
        # Signed per-feature contributions (log-odds) for the dashboard chart: red pushes risk up, green down.
        top = sorted(zip(FEATURES, contrib), key=lambda fc: -abs(fc[1]))[:7]
        factors = [{"feature": f, "label": LABELS[f], "value": round(float(v), 3)} for f, v in top if abs(v) > 0.05]
        return prob, reasons, factors

    def score_many(self, rows: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(rows)[:, 1]
