"""Scammer-workaround detector (M11).

Scores payments by session, not one by one: a victim told to whitelist an account, raise a limit or
split a payment under ₹10,000 shows up in the account's recent history.
"""
import sqlite3
import time

from .features import THRESHOLD

SESSION_WINDOW_S = 30 * 60


def session_features(c: sqlite3.Connection, account_id: str, payee_id: str, amount: float, exclude_id: str) -> dict:
    since = time.time() - SESSION_WINDOW_S
    prior = c.execute(
        "SELECT amount FROM payments WHERE account_id=? AND payee_id=? AND created_at>=?"
        " AND state NOT IN ('cancelled','reversed') AND duress=0 AND id!=?",
        (account_id, payee_id, since, exclude_id),
    ).fetchall()
    chunks = [r["amount"] for r in prior if r["amount"] < THRESHOLD]
    if amount < THRESHOLD:
        chunks.append(amount)
    session_total = sum(r["amount"] for r in prior) + amount
    # Two or more sub-threshold payments to the same payee that together cross the threshold.
    split_detected = len(chunks) >= 2 and sum(chunks) >= THRESHOLD

    whitelisted_in_call = c.execute(
        "SELECT 1 FROM events WHERE account_id=? AND kind='payee_added' AND payee_id=?"
        " AND call_active=1 AND ts>=?",
        (account_id, payee_id, since),
    ).fetchone()
    limit_raised_in_call = c.execute(
        "SELECT 1 FROM events WHERE account_id=? AND kind='limit_raised' AND call_active=1 AND ts>=?",
        (account_id, since),
    ).fetchone()
    return {
        "split_count": len(chunks) if split_detected else max(len(chunks) - 1, 0),
        "split_detected": split_detected,
        "session_total": session_total,
        "whitelist_during_call": int(whitelisted_in_call is not None),
        "limit_raised_during_call": int(limit_raised_in_call is not None),
    }


def record_event(c: sqlite3.Connection, account_id: str, kind: str, payee_id: str | None, call_active: bool):
    c.execute(
        "INSERT INTO events (account_id, kind, payee_id, ts, call_active) VALUES (?,?,?,?,?)",
        (account_id, kind, payee_id, time.time(), int(call_active)),
    )
