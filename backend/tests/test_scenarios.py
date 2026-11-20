"""The five demo scenarios from docs/plan.md, end to end through the API."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ["SAFEWORD_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from app import db  # noqa: E402
from app.main import app  # noqa: E402

ACCT = "demo-senior-1"
CALM = dict(call_active=False, caller_in_contacts=True, screen_shared=False, behaviour_anomaly=0.05, hour_of_day=11)
CALL = dict(call_active=True, caller_in_contacts=False, screen_shared=False, behaviour_anomaly=0.6, hour_of_day=11)
ARREST = dict(CALL, screen_shared=True, behaviour_anomaly=0.8)


@pytest.fixture()
def client():
    db.init_db(reset=True)
    with TestClient(app) as c:
        yield c


def pay(client, payee, amount, signals, pin="normal"):
    r = client.post("/payments/initiate", json=dict(account_id=ACCT, payee_id=payee, amount=amount, pin_type=pin, signals=signals))
    assert r.status_code == 200, r.text
    return r.json()


def test_1_normal_payment_goes_through(client):
    r = pay(client, "p1", 500, CALM)
    assert r["decision"] == "allow"
    assert client.get(f"/payments/{r['payment_id']}/status").json()["status"] == "success"


def test_2_digital_arrest_holds_and_asks_family(client):
    r = pay(client, "p2", 200000, ARREST)
    assert r["decision"] == "hold" and r["reasons"]
    assert any(a["payment_id"] == r["payment_id"] for a in client.get("/approvals/pending").json())
    assert client.get(f"/payments/{r['payment_id']}/status").json()["status"] == "pending"
    # money is on hold, not gone
    acct = client.get(f"/accounts/{ACCT}").json()
    assert acct["hold"] == 200000 and acct["balance"] == 50000
    client.post(f"/approvals/{r['payment_id']}", json={"approve": False})
    assert client.get(f"/accounts/{ACCT}").json()["balance"] == 250000


def test_3_split_payments_detected(client):
    # Clean payee (p1) isolates the workaround rule from the mule-graph signal.
    first = pay(client, "p1", 9500, CALL)
    second = pay(client, "p1", 9500, CALL)
    assert first["decision"] != "hold"  # one sub-threshold chunk alone is not a workaround
    assert second["decision"] == "hold"  # session scoring: two chunks crossing ₹10,000 during a call
    assert any("split" in r for r in second["reasons"])
    # and the scripted version: 6 x 9,500 to the new payee never gets through
    assert all(pay(client, "p2", 9500, CALL)["decision"] == "hold" for _ in range(6))


def test_4_whitelist_trick_prompts(client):
    p = client.post("/payees", json=dict(account_id=ACCT, name="Helpful Agent", upi_id="agent@demo", signals=CALL)).json()
    client.patch("/limits", json=dict(account_id=ACCT, daily_limit=500000, signals=CALL))
    r = pay(client, p["id"], 20000, CALL)
    assert r["decision"] in ("prompt", "hold") and r["reasons"]


def test_5_silent_sos_holds_without_risk_engine(client):
    r = pay(client, "p1", 500, CALM, pin="duress")  # even a harmless-looking payment
    assert r["decision"] == "hold" and r["reasons"] == []
    pid = r["payment_id"]
    assert client.get(f"/payments/{pid}/status").json()["status"] == "pending"
    assert client.post(f"/payments/{pid}/cancel").json()["status"] == "pending"  # cannot be cancelled
    assert client.get("/approvals/pending").json() == []  # no family request that could tip off the scammer
    alerts = client.get("/notifications", params=dict(audience="fraud_team")).json()
    assert any(n["urgent"] and n["payment_id"] == pid for n in alerts)
    case = client.get(f"/cases/{pid}").json()
    assert case["duress"] and case["risk_score"] is None
    assert client.get("/cases").json()[0]["payment_id"] == pid  # duress sorts first
    assert client.post(f"/cases/{pid}/release").status_code == 200  # only an officer can release


def test_prompt_confirm_and_cancel(client):
    client.post("/payees", json=dict(account_id=ACCT, name="X", upi_id="x@demo", signals=CALL))
    p = client.post("/payees", json=dict(account_id=ACCT, name="Y", upi_id="y@demo", signals=CALL)).json()
    r = pay(client, p["id"], 3000, CALL)
    if r["decision"] == "prompt":
        assert client.post(f"/payments/{r['payment_id']}/confirm").json()["status"] == "success"


def test_no_auto_release_and_audit(client):
    r = pay(client, "p2", 200000, ARREST)
    pid = r["payment_id"]
    assert client.get(f"/payments/{pid}/status").json()["status"] == "pending"
    client.post(f"/cases/{pid}/release")
    events = [a["event"] for a in client.get("/audit", params=dict(payment_id=pid)).json()]
    assert events == ["initiated", "held", "released"]
    assert client.get(f"/cases/{pid}/report").json()["outcome"] == "released"
