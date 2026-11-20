"""Metrics report (B's deliverable): false holds, scam scenarios caught, time to intervene.

Run:  python backend/metrics.py     (writes docs/metrics.json)
Model metrics use the held-out data/test.csv. Everything is synthetic: these numbers describe the
simulator, not real-world performance.
"""
import json
import os
import statistics
import tempfile
import time
from pathlib import Path

import pandas as pd

os.environ["SAFEWORD_DB"] = os.path.join(tempfile.mkdtemp(), "metrics.db")

from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402
from app.features import FEATURES  # noqa: E402
from app.main import app, engine  # noqa: E402
from app.tiers import decide  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ACCT = "demo-senior-1"
CALM = dict(call_active=False, caller_in_contacts=True, screen_shared=False, behaviour_anomaly=0.05, hour_of_day=11)
CALL = dict(call_active=True, caller_in_contacts=False, screen_shared=False, behaviour_anomaly=0.6, hour_of_day=11)


def model_metrics() -> dict:
    test = pd.read_csv(ROOT / "data" / "test.csv")
    e = engine()
    probs = e.score_many(test[FEATURES].to_numpy())
    decisions = [
        decide(p, {**row, "call_active": row["call_active"]}, e.thresholds)
        for p, row in zip(probs, test[FEATURES].to_dict("records"))
    ]
    test = test.assign(decision=decisions)
    genuine, scam = test[test.label == 0], test[test.label == 1]
    return {
        "thresholds": e.thresholds,
        "test_rows": len(test),
        "genuine_payments": len(genuine),
        "false_hold_rate": round(float((genuine.decision == "hold").mean()), 4),
        "false_prompt_rate": round(float((genuine.decision == "prompt").mean()), 4),
        "scams_held_pct": round(float((scam.decision == "hold").mean()) * 100, 1),
        "scams_intervened_pct": round(float((scam.decision != "allow").mean()) * 100, 1),
        "scams_caught_by_script_pct": {
            s: round(float((g.decision != "allow").mean()) * 100, 1) for s, g in scam.groupby("source")
        },
    }


def scenario_metrics() -> dict:
    db.init_db(reset=True)
    out, latencies = {}, []
    with TestClient(app) as c:
        def pay(payee, amount, signals, pin="normal"):
            t = time.perf_counter()
            r = c.post("/payments/initiate", json=dict(account_id=ACCT, payee_id=payee, amount=amount, pin_type=pin, signals=signals)).json()
            return r, (time.perf_counter() - t) * 1000

        db.init_db(reset=True)
        r, _ = pay("p1", 500, CALM)
        out["1_normal"] = r["decision"]
        db.init_db(reset=True)  # each scenario starts from a fresh account
        r, ms = pay("p2", 200000, dict(CALL, screen_shared=True, behaviour_anomaly=0.8))
        out["2_digital_arrest"] = r["decision"]; latencies.append(ms)
        db.init_db(reset=True)
        rs = [pay("p2", 9500, CALL) for _ in range(6)]
        out["3_split_6x9500"] = [x[0]["decision"] for x in rs]; latencies += [x[1] for x in rs]
        db.init_db(reset=True)
        p = c.post("/payees", json=dict(account_id=ACCT, name="Agent", upi_id="a@demo", signals=CALL)).json()
        c.patch("/limits", json=dict(account_id=ACCT, daily_limit=500000, signals=CALL))
        r, ms = pay(p["id"], 20000, CALL)
        out["4_whitelist_trick"] = r["decision"]; latencies.append(ms)
        db.init_db(reset=True)
        r, ms = pay("p1", 500, CALM, pin="duress")
        out["5_silent_sos"] = r["decision"]; latencies.append(ms)
    out["median_time_to_intervene_ms"] = round(statistics.median(latencies), 1)
    return out


if __name__ == "__main__":
    report = {"model_on_heldout_synthetic_data": model_metrics(), "demo_scenarios": scenario_metrics()}
    (ROOT / "docs" / "metrics.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
