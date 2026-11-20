"""SafeWord bank simulator API. Contract: api/openapi.yaml."""
import json
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import db, ledger, workaround
from .features import amount_features, is_night
from .graph import payee_features, snapshot
from .risk import RiskEngine
from .tiers import decide

GOLDEN_HOUR_S = 3600

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="SafeWord Bank Simulator", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_engine: RiskEngine | None = None


def engine() -> RiskEngine:
    global _engine
    if _engine is None:
        _engine = RiskEngine()
    return _engine


# ---------- schemas ----------
class Signals(BaseModel):
    call_active: bool
    caller_in_contacts: Optional[bool] = None
    screen_shared: bool
    behaviour_anomaly: float = Field(ge=0, le=1)
    hour_of_day: int = Field(ge=0, le=23)
    time_to_pay_ms: Optional[int] = None


class InitiateRequest(BaseModel):
    account_id: str
    payee_id: str
    amount: float
    pin_type: Literal["normal", "duress"]
    signals: Signals


class PayeeRequest(BaseModel):
    account_id: str
    name: str
    upi_id: str
    signals: Signals


class LimitRequest(BaseModel):
    daily_limit: float
    signals: Signals
    account_id: str = "demo-senior-1"


class ApprovalDecision(BaseModel):
    approve: bool


def _iso(ts: float | None) -> str | None:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None


def _get_payment(c, payment_id: str):
    p = c.execute("SELECT * FROM payments WHERE id=?", (payment_id,)).fetchone()
    if p is None:
        raise HTTPException(404, "payment not found")
    return p


def _status(p) -> dict:
    return {"payment_id": p["id"], "status": ledger.app_status(p)}


def _call(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except ledger.LedgerError as e:
        raise HTTPException(409, str(e))


# ---------- payments ----------
@app.post("/payments/initiate")
def initiate(req: InitiateRequest):
    pid = uuid.uuid4().hex
    duress = req.pin_type == "duress"
    with db.connect() as c:
        acct = c.execute("SELECT * FROM accounts WHERE id=?", (req.account_id,)).fetchone()
        payee = c.execute("SELECT * FROM payees WHERE id=?", (req.payee_id,)).fetchone()
        if acct is None or payee is None:
            raise HTTPException(404, "unknown account or payee")
        try:
            ledger.create_payment(c, pid, req.account_id, req.payee_id, req.amount, duress, req.signals.model_dump())
        except ledger.LedgerError as e:
            raise HTTPException(400, str(e))

        if duress:
            # Duress rule: never calls the risk engine, always holds, alerts the fraud team, no timer release.
            ledger.transition(c, pid, "held", detail={"reason": "SafeWord PIN used"})
            ledger.notify(c, "fraud_team", pid, f"DURESS ALERT: {acct['name']} entered the SafeWord PIN", urgent=True)
            return {"decision": "hold", "payment_id": pid, "reasons": [], "prompt_lang": acct["lang"]}

        sig = req.signals
        wa = workaround.session_features(c, req.account_id, req.payee_id, req.amount, pid)
        known = c.execute(
            "SELECT 1 FROM payments WHERE account_id=? AND payee_id=? AND state IN ('allowed','released') AND id!=?",
            (req.account_id, req.payee_id, pid),
        ).fetchone()
        feats = {
            "call_active": int(sig.call_active),
            "caller_unknown": int(sig.call_active and sig.caller_in_contacts is not True),
            "screen_shared": int(sig.screen_shared),
            "behaviour_anomaly": sig.behaviour_anomaly,
            "night": is_night(sig.hour_of_day),
            "payee_is_new": int(known is None),
            **payee_features(c, req.payee_id),
            **amount_features(req.amount, wa["session_total"]),
            **wa,
        }
        prob, reasons, factors = engine().score(feats)
        decision = decide(prob, feats, engine().thresholds)
        if decision != "allow":  # rules that triggered the decision are listed first, before SHAP reasons
            reasons = _rule_reasons(feats) + [r for r in reasons if r not in _rule_reasons(feats)]
        c.execute(
            "UPDATE payments SET risk=?, reasons=?, factors=? WHERE id=?", (prob, json.dumps(reasons), json.dumps(factors), pid)
        )

        if decision == "allow":
            ledger.transition(c, pid, "allowed", detail={"risk": prob})
        elif decision == "prompt":
            ledger.transition(c, pid, "prompted", detail={"risk": prob, "reasons": reasons})
        else:
            ledger.transition(c, pid, "held", detail={"risk": prob, "reasons": reasons})
            c.execute("INSERT INTO approvals VALUES (?, 'pending', ?)", (pid, time.time()))
            ledger.notify(c, "trusted_person", pid, f"{acct['name']} needs your approval for ₹{req.amount:,.0f}")
            ledger.notify(c, "fraud_team", pid, f"High-risk payment held: ₹{req.amount:,.0f}", urgent=False)
        return {"decision": decision, "payment_id": pid, "reasons": reasons, "prompt_lang": acct["lang"]}


def _rule_reasons(f: dict) -> list[str]:
    out = []
    if f.get("split_detected"):
        out.append("This payment looks like part of a larger amount split into smaller ones")
    if f.get("whitelist_during_call"):
        out.append("This payee was added during the same phone call")
    if f.get("limit_raised_during_call"):
        out.append("Your payment limit was raised during a phone call")
    return out


@app.post("/payments/{payment_id}/confirm")
def confirm(payment_id: str):
    with db.connect() as c:
        _get_payment(c, payment_id)
        p = _call(ledger.transition, c, payment_id, "allowed", "user", {"after": "voice prompt"})
        return _status(p)


@app.post("/payments/{payment_id}/cancel")
def cancel(payment_id: str):
    with db.connect() as c:
        p = _get_payment(c, payment_id)
        if p["duress"]:  # a coerced user cannot cancel a duress hold; it stays "pending"
            ledger.audit(c, payment_id, "cancel_ignored", {"reason": "duress"}, "user")
            return _status(p)
        p = _call(ledger.transition, c, payment_id, "cancelled", "user")
        return _status(p)


@app.get("/payments/{payment_id}/status")
def status(payment_id: str):
    with db.connect() as c:
        return _status(_get_payment(c, payment_id))


# ---------- payees, limits, accounts ----------
@app.post("/payees")
def add_payee(req: PayeeRequest):
    pid = "p_" + uuid.uuid4().hex[:8]
    with db.connect() as c:
        # Simulator assumption: an account the customer just added is a recently opened one (5 days).
        c.execute(
            "INSERT INTO payees VALUES (?,?,?,?,?,?,0)", (pid, req.name, req.upi_id, req.account_id, 5, time.time())
        )
        workaround.record_event(c, req.account_id, "payee_added", pid, req.signals.call_active)
    return {"id": pid, "name": req.name, "upi_id": req.upi_id}


@app.patch("/limits")
def change_limit(req: LimitRequest):
    with db.connect() as c:
        acct = c.execute("SELECT daily_limit FROM accounts WHERE id=?", (req.account_id,)).fetchone()
        if acct is None:
            raise HTTPException(404, "unknown account")
        if req.daily_limit > acct["daily_limit"]:
            workaround.record_event(c, req.account_id, "limit_raised", None, req.signals.call_active)
        c.execute("UPDATE accounts SET daily_limit=? WHERE id=?", (req.daily_limit, req.account_id))
    return {"daily_limit": req.daily_limit}


@app.get("/accounts/{account_id}")
def get_account(account_id: str):
    with db.connect() as c:
        a = c.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
        if a is None:
            raise HTTPException(404, "unknown account")
        payees = c.execute(
            "SELECT id, name, upi_id FROM payees WHERE known_mule=0 AND (owner_account IS NULL OR owner_account=?)",
            (account_id,),
        ).fetchall()
        return {**dict(a), "payees": [dict(p) for p in payees]}


# ---------- trusted person ----------
@app.get("/approvals/pending")
def approvals_pending():
    with db.connect() as c:
        rows = c.execute(
            "SELECT p.id, p.amount, p.reasons, a.name AS senior_name, y.name AS payee_name FROM approvals ap"
            " JOIN payments p ON p.id=ap.payment_id JOIN accounts a ON a.id=p.account_id"
            " JOIN payees y ON y.id=p.payee_id WHERE ap.status='pending' AND p.state='held'"
        ).fetchall()
        return [
            {
                "payment_id": r["id"],
                "senior_name": r["senior_name"],
                "payee_name": r["payee_name"],
                "amount": r["amount"],
                "reasons": json.loads(r["reasons"] or "[]"),
            }
            for r in rows
        ]


@app.post("/approvals/{payment_id}")
def decide_approval(payment_id: str, body: ApprovalDecision):
    with db.connect() as c:
        ap = c.execute("SELECT * FROM approvals WHERE payment_id=? AND status='pending'", (payment_id,)).fetchone()
        if ap is None:
            raise HTTPException(404, "no pending approval")
        c.execute("UPDATE approvals SET status=? WHERE payment_id=?", ("approved" if body.approve else "rejected", payment_id))
        _call(ledger.transition, c, payment_id, "released" if body.approve else "reversed", "trusted_person")
    return {"ok": True}


# ---------- fraud-team cases ----------
def _case(c, p, detail: bool = False) -> dict:
    payee = c.execute("SELECT name FROM payees WHERE id=?", (p["payee_id"],)).fetchone()
    duress = bool(p["duress"])
    reasons = ["Customer entered the SafeWord (duress) PIN: possible coercion"] if duress else json.loads(p["reasons"] or "[]")
    out = {
        "payment_id": p["id"],
        "account_id": p["account_id"],
        "state": p["state"],
        "duress": duress,
        "risk_score": None if duress else p["risk"],  # duress never goes through the risk engine
        "reasons": reasons,
        "amount": p["amount"],
        "payee_id": p["payee_id"],
        "payee_name": payee["name"],
        "held_at": _iso(p["held_at"]),
        "golden_hour_ends_at": _iso(p["held_at"] + GOLDEN_HOUR_S) if p["held_at"] else None,
        "factors": [] if duress else json.loads(p["factors"] or "[]"),
        "signals": json.loads(p["signals"] or "{}"),
    }
    if detail:
        out["timeline"] = [
            {"ts": _iso(a["ts"]), "actor": a["actor"], "event": a["event"], "detail": json.loads(a["detail"] or "{}")}
            for a in c.execute("SELECT * FROM audit WHERE payment_id=? ORDER BY id", (p["id"],))
        ]
        out["payee_graph"] = snapshot(c, p["payee_id"])
    return out


@app.get("/cases")
def list_cases(state: Optional[str] = None):
    with db.connect() as c:
        rows = c.execute("SELECT * FROM payments WHERE held_at IS NOT NULL").fetchall()
        cases = [_case(c, p) for p in rows if state is None or p["state"] == state]
    # open cases first, then duress, then highest risk, then oldest (most urgent golden hour)
    cases.sort(key=lambda x: (x["state"] != "held", not x["duress"], -(x["risk_score"] or 0), x["held_at"]))
    return cases


@app.get("/cases/{payment_id}")
def get_case(payment_id: str):
    with db.connect() as c:
        p = _get_payment(c, payment_id)
        if p["held_at"] is None:
            raise HTTPException(404, "not a held payment")
        return _case(c, p, detail=True)


@app.post("/cases/{payment_id}/release")
def release(payment_id: str):
    with db.connect() as c:
        _get_payment(c, payment_id)
        _call(ledger.transition, c, payment_id, "released", "officer")
    return {"ok": True}


@app.post("/cases/{payment_id}/reverse")
def reverse(payment_id: str):
    with db.connect() as c:
        _get_payment(c, payment_id)
        _call(ledger.transition, c, payment_id, "reversed", "officer")
    return {"ok": True}


@app.get("/cases/{payment_id}/report")
def cybercrime_report(payment_id: str):
    """Structured incident report for the cybercrime portal (simulated format)."""
    with db.connect() as c:
        p = _get_payment(c, payment_id)
        if p["held_at"] is None:
            raise HTTPException(404, "not a held payment")
        case = _case(c, p, detail=True)
    return {
        "report_type": "authorised_push_payment_fraud",
        "generated_at": _iso(time.time()),
        "payment_id": case["payment_id"],
        "victim_account": case["account_id"],
        "amount_inr": case["amount"],
        "beneficiary": {"id": case["payee_id"], "name": case["payee_name"], "graph": case["payee_graph"]},
        "indicators": case["reasons"],
        "duress_signal": case["duress"],
        "held_at": case["held_at"],
        "outcome": case["state"],
        "audit_trail": case["timeline"],
    }


# ---------- notifications and audit (hooks + clear record) ----------
@app.get("/notifications")
def notifications(audience: Optional[str] = None):
    with db.connect() as c:
        q = "SELECT * FROM notifications" + (" WHERE audience=?" if audience else "") + " ORDER BY id DESC LIMIT 100"
        rows = c.execute(q, (audience,) if audience else ()).fetchall()
        return [{**dict(r), "ts": _iso(r["ts"]), "urgent": bool(r["urgent"])} for r in rows]


@app.get("/audit")
def audit_log(payment_id: Optional[str] = None):
    with db.connect() as c:
        q = "SELECT * FROM audit" + (" WHERE payment_id=?" if payment_id else "") + " ORDER BY id"
        rows = c.execute(q, (payment_id,) if payment_id else ()).fetchall()
        return [{**dict(r), "ts": _iso(r["ts"]), "detail": json.loads(r["detail"] or "{}")} for r in rows]


@app.get("/health")
def health():
    return {"ok": True}
