"""Synthetic data generator (M8).

Writes, next to this file:
  train.csv / test.csv   labelled payment sessions in model-feature space (test is held out)
  behaviour.csv          raw behaviour samples for the on-device TFLite anomaly model
  mule_network.json     background transaction graph with mule rings, loaded by the bank simulator

Everything is synthetic. Scam rows follow the five demo scripts in docs/plan.md.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))
from app.features import FEATURES, THRESHOLD  # noqa: E402

rng = np.random.default_rng(7)

PERSONAS = {  # typical payment size (median INR), share of normal traffic
    "senior": (600, 0.35),
    "rural_first_timer": (300, 0.25),
    "urban": (1500, 0.40),
}


def _row(**kw) -> dict:
    """Fill defaults for an ordinary, low-risk session, then apply overrides."""
    amount = kw.pop("amount")
    session_total = kw.pop("session_total", amount)
    row = {
        "call_active": 0, "caller_unknown": 0, "screen_shared": 0, "behaviour_anomaly": 0.1,
        "night": 0, "payee_age_days": 500.0, "payee_is_new": 0, "in_velocity": 0.0,
        "fan_out_ratio": 0.1, "hops_to_mule": 6.0, "split_count": 0,
        "whitelist_during_call": 0, "limit_raised_during_call": 0,
    }
    row.update(kw)
    row["amount_log"] = np.log10(max(amount, 1))
    row["over_10k"] = int(amount >= THRESHOLD)
    row["session_total_log"] = np.log10(max(session_total, 1))
    return row


def normal_session(persona: str) -> dict:
    median, _ = PERSONAS[persona]
    amount = float(np.clip(rng.lognormal(np.log(median), 0.9), 10, 60000))
    kind = rng.random()
    kw = dict(
        behaviour_anomaly=float(rng.beta(1.5, 10)),
        night=int(rng.random() < 0.03),
        payee_age_days=float(rng.integers(60, 3000)),
        payee_is_new=int(rng.random() < 0.08),
        in_velocity=float(rng.poisson(0.6)),
        fan_out_ratio=float(rng.beta(1, 8)),
        hops_to_mule=float(rng.choice([4, 5, 6, 6, 6])),
    )
    if kind < 0.06:  # genuine call while paying: family member in contacts
        kw.update(call_active=1, caller_unknown=0)
    if 0.06 <= kind < 0.09:  # hard negative: legitimate call from an unknown number (e.g. courier)
        kw.update(call_active=1, caller_unknown=1)
    if 0.09 <= kind < 0.13:  # hard negative: genuine big one-off to a new payee (rent, fees)
        amount = float(rng.uniform(10000, 40000))
        kw.update(payee_is_new=1, payee_age_days=float(rng.integers(40, 900)))
    if 0.17 <= kind < 0.21:  # hard negative: anxious genuine user on an unknown call (courier, bank helpline)
        kw.update(call_active=1, caller_unknown=1, behaviour_anomaly=float(rng.beta(3, 4)))
    if 0.13 <= kind < 0.17:  # hard negative: new small business with brisk inflow
        kw.update(payee_age_days=float(rng.integers(15, 120)), in_velocity=float(rng.integers(3, 8)))
    return _row(amount=amount, **kw)


def scam_session(script: str) -> dict:
    anomaly = float(rng.beta(4, 3))
    mule = dict(
        payee_is_new=1,
        payee_age_days=float(rng.integers(0, 12)),
        in_velocity=float(rng.integers(3, 20)),
        fan_out_ratio=float(rng.uniform(0.4, 1.6)),
        hops_to_mule=float(rng.choice([0, 1, 1, 2, 2, 3])),
    )
    if rng.random() < 0.3:  # scammer's account not yet flagged: ordinary-looking payee features
        mule = dict(payee_is_new=1, payee_age_days=float(rng.integers(20, 300)), in_velocity=float(rng.poisson(1)),
                    fan_out_ratio=float(rng.beta(1, 6)), hops_to_mule=float(rng.choice([4, 5, 6])))
    if script == "digital_arrest":
        return _row(amount=float(rng.uniform(80000, 400000)), call_active=1, caller_unknown=1,
                    screen_shared=int(rng.random() < 0.8), behaviour_anomaly=anomaly,
                    night=int(rng.random() < 0.15), **mule)
    if script == "investment":
        call = int(rng.random() < 0.4)
        return _row(amount=float(rng.uniform(15000, 150000)), call_active=call, caller_unknown=call,
                    behaviour_anomaly=float(rng.beta(3, 4)), **mule)
    if script == "kyc_update":
        return _row(amount=float(rng.uniform(4000, 40000)), call_active=1, caller_unknown=1,
                    behaviour_anomaly=anomaly, whitelist_during_call=int(rng.random() < 0.7), **mule)
    if script == "split":
        chunk = float(rng.uniform(8000, 9900))
        n = int(rng.integers(2, 7))
        return _row(amount=chunk, session_total=chunk * n, split_count=n, call_active=1, caller_unknown=1,
                    behaviour_anomaly=anomaly, **mule)
    if script == "whitelist_trick":
        return _row(amount=float(rng.uniform(5000, 60000)), call_active=1, caller_unknown=1,
                    whitelist_during_call=1, limit_raised_during_call=int(rng.random() < 0.7),
                    behaviour_anomaly=anomaly, **mule)
    raise ValueError(script)


SCRIPTS = ["digital_arrest", "investment", "kyc_update", "split", "whitelist_trick"]


def make_dataset(n_normal: int, n_scam: int) -> pd.DataFrame:
    rows = []
    personas, weights = zip(*[(k, v[1]) for k, v in PERSONAS.items()])
    for _ in range(n_normal):
        p = str(rng.choice(personas, p=weights))
        rows.append({**normal_session(p), "label": 0, "source": p})
    for i in range(n_scam):
        s = SCRIPTS[i % len(SCRIPTS)]
        rows.append({**scam_session(s), "label": 1, "source": s})
    df = pd.DataFrame(rows)
    return df[FEATURES + ["label", "source"]].sample(frac=1, random_state=7).reset_index(drop=True)


def make_behaviour(n: int) -> pd.DataFrame:
    """Raw behaviour as the phone measures it: coerced users type slowly/hesitate and pay at odd hours."""
    rows = []
    for _ in range(n):
        coerced = rng.random() < 0.3
        rows.append({
            "typing_cps": rng.normal(2.2 if coerced else 3.5, 0.7),
            "time_to_pay_s": rng.normal(75 if coerced else 25, 15 if coerced else 8),
            "hesitation_s": rng.gamma(4 if coerced else 1.5, 2.0),
            "hour_delta": float(rng.choice([0, 1, 2, 3, 6, 9], p=[0.1, 0.1, 0.1, 0.1, 0.3, 0.3] if coerced
                                           else [0.5, 0.25, 0.15, 0.07, 0.02, 0.01])),
            "label": int(coerced),
        })
    return pd.DataFrame(rows).clip(lower=0)


def make_network() -> dict:
    """Shop with steady customers; a mule ring around demo payee p2 with fast fan-in and fan-out."""
    transfers = []
    for i in range(40):  # p1: steady inflow over 30 days
        transfers.append({"src": f"cust{i}", "dst": "p1", "amount": int(rng.integers(50, 800)),
                          "age_s": float(rng.uniform(3600, 30 * 86400))})
    for i in range(8):  # p2: 8 victims in the last 6 hours
        transfers.append({"src": f"victim{i}", "dst": "p2", "amount": int(rng.integers(5000, 90000)),
                          "age_s": float(rng.uniform(60, 6 * 3600))})
    for dst in ["mule_boss", "m_a", "m_b", "m_c", "m_d"]:  # then fans out, one hop to a known mule
        transfers.append({"src": "p2", "dst": dst, "amount": 40000, "age_s": 1800.0})
    return {"known_mules": ["mule_boss"], "transfers": transfers}


if __name__ == "__main__":
    train = make_dataset(18000, 2400)
    test = make_dataset(6000, 800)  # held out: never used for fitting or threshold tuning
    train.to_csv(HERE / "train.csv", index=False)
    test.to_csv(HERE / "test.csv", index=False)
    make_behaviour(6000).to_csv(HERE / "behaviour.csv", index=False)
    (HERE / "mule_network.json").write_text(json.dumps(make_network()))
    print(f"train {len(train)} rows ({train.label.mean():.1%} scam), test {len(test)} rows")
