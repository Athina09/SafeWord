"""Held-payment ledger (M7).

Money is moved from balance to a hold the moment a payment starts, so nothing leaves until a
payment is allowed or released. Every transition is written to the audit log.
"""
import json
import sqlite3
import time

# initiated -> allowed | prompted | held ; prompted -> allowed | cancelled ; held -> released | reversed
TRANSITIONS = {
    "initiated": {"allowed", "prompted", "held"},
    "prompted": {"allowed", "cancelled"},
    "held": {"released", "reversed"},
}


class LedgerError(Exception):
    pass


def audit(c: sqlite3.Connection, payment_id: str, event: str, detail: dict | None = None, actor: str = "system"):
    c.execute(
        "INSERT INTO audit (payment_id, ts, actor, event, detail) VALUES (?,?,?,?,?)",
        (payment_id, time.time(), actor, event, json.dumps(detail or {})),
    )


def notify(c: sqlite3.Connection, audience: str, payment_id: str, message: str, urgent: bool = False):
    c.execute(
        "INSERT INTO notifications (ts, audience, payment_id, message, urgent) VALUES (?,?,?,?,?)",
        (time.time(), audience, payment_id, message, int(urgent)),
    )


def create_payment(c, payment_id, account_id, payee_id, amount, duress, signals) -> None:
    acct = c.execute("SELECT balance FROM accounts WHERE id=?", (account_id,)).fetchone()
    if acct is None:
        raise LedgerError("unknown account")
    if amount <= 0 or amount > acct["balance"]:
        raise LedgerError("invalid amount or insufficient balance")
    c.execute("UPDATE accounts SET balance=balance-?, hold=hold+? WHERE id=?", (amount, amount, account_id))
    c.execute(
        "INSERT INTO payments (id, account_id, payee_id, amount, state, duress, signals, created_at)"
        " VALUES (?,?,?,?,'initiated',?,?,?)",
        (payment_id, account_id, payee_id, amount, int(duress), json.dumps(signals), time.time()),
    )
    audit(c, payment_id, "initiated", {"amount": amount, "duress": duress, "debited_to_hold": True})


def transition(c, payment_id: str, new_state: str, actor: str = "system", detail: dict | None = None) -> sqlite3.Row:
    p = c.execute("SELECT * FROM payments WHERE id=?", (payment_id,)).fetchone()
    if p is None:
        raise LedgerError("unknown payment")
    if new_state not in TRANSITIONS.get(p["state"], set()):
        raise LedgerError(f"cannot go from {p['state']} to {new_state}")
    c.execute("UPDATE payments SET state=? WHERE id=?", (new_state, payment_id))
    if new_state == "held":
        c.execute("UPDATE payments SET held_at=? WHERE id=?", (time.time(), payment_id))
    if new_state in ("allowed", "released"):  # settle: the hold leaves the bank
        c.execute("UPDATE accounts SET hold=hold-? WHERE id=?", (p["amount"], p["account_id"]))
        c.execute(
            "INSERT INTO transfers VALUES (?,?,?,?)", (p["account_id"], p["payee_id"], p["amount"], time.time())
        )
    if new_state in ("cancelled", "reversed"):  # refund: the hold returns to the balance
        c.execute(
            "UPDATE accounts SET hold=hold-?, balance=balance+? WHERE id=?",
            (p["amount"], p["amount"], p["account_id"]),
        )
    audit(c, payment_id, new_state, detail, actor)
    return c.execute("SELECT * FROM payments WHERE id=?", (payment_id,)).fetchone()


def app_status(p: sqlite3.Row) -> str:
    """What the phone is told. Duress payments always read 'pending' unless an officer released them."""
    if p["duress"]:
        return "success" if p["state"] == "released" else "pending"
    return {
        "initiated": "pending",
        "prompted": "pending",
        "held": "pending",
        "allowed": "success",
        "released": "success",
        "cancelled": "cancelled",
        "reversed": "rejected",
    }[p["state"]]
