"""SQLite ledger for the bank simulator (M7) and the seeded demo world."""
import json
import os
import random
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "backend" / "safeword.db"
MULE_NETWORK = ROOT / "data" / "mule_network.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, name TEXT, balance REAL, hold REAL DEFAULT 0,
  daily_limit REAL, lang TEXT DEFAULT 'en', trusted_name TEXT
);
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY, name TEXT, upi_id TEXT, owner_account TEXT,
  acct_opened_days_ago REAL, added_at REAL, known_mule INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, account_id TEXT, payee_id TEXT, amount REAL,
  state TEXT, duress INTEGER DEFAULT 0, risk REAL, reasons TEXT, factors TEXT, signals TEXT,
  created_at REAL, held_at REAL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT, ts REAL,
  actor TEXT, event TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS transfers (src TEXT, dst TEXT, amount REAL, ts REAL);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT, kind TEXT, payee_id TEXT,
  ts REAL, call_active INTEGER
);
CREATE TABLE IF NOT EXISTS approvals (
  payment_id TEXT PRIMARY KEY, status TEXT DEFAULT 'pending', created_at REAL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, audience TEXT,
  payment_id TEXT, message TEXT, urgent INTEGER DEFAULT 0
);
"""


def db_path() -> str:
    return os.environ.get("SAFEWORD_DB", str(DEFAULT_DB))


@contextmanager
def connect():
    c = sqlite3.connect(db_path())
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db(reset: bool = False) -> None:
    if reset and Path(db_path()).exists():
        Path(db_path()).unlink()
    with connect() as c:
        c.executescript(SCHEMA)
        if c.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0:
            _seed(c)


def _seed(c: sqlite3.Connection) -> None:
    now = time.time()
    c.execute(
        "INSERT INTO accounts VALUES ('demo-senior-1','Kamala Devi',250000,0,50000,'en','Ravi (son)')"
    )
    # p1: long-standing shop. p2: the "new payee" used in the scam scripts. mule_boss: known mule.
    payees = [
        ("p1", "Sharma General Store", "sharma@demo", None, 900, now - 400 * 86400, 0),
        ("p2", "New Payee (unverified)", "new@demo", None, 3, now, 0),
        ("mule_boss", "Known mule", "mule@demo", None, 20, now - 10 * 86400, 1),
    ]
    c.executemany("INSERT INTO payees VALUES (?,?,?,?,?,?,?)", payees)
    # A prior successful payment makes p1 a known payee (payee_is_new = no prior success).
    c.execute(
        "INSERT INTO payments VALUES ('seed-1','demo-senior-1','p1',450,'allowed',0,0.02,'[]','[]','{}',?,NULL)",
        (now - 30 * 86400,),
    )
    c.execute("INSERT INTO transfers VALUES ('demo-senior-1','p1',450,?)", (now - 30 * 86400,))
    _seed_network(c, now)


def _seed_network(c: sqlite3.Connection, now: float) -> None:
    """Background transaction graph. Uses data/mule_network.json (from data/generate.py) if present."""
    if MULE_NETWORK.exists():
        net = json.loads(MULE_NETWORK.read_text())
        c.executemany(
            "INSERT INTO transfers VALUES (?,?,?,?)",
            [(t["src"], t["dst"], t["amount"], now - t["age_s"]) for t in net["transfers"]],
        )
        return
    rng = random.Random(1)
    for i in range(40):  # shop: steady inflow spread over 30 days
        c.execute(
            "INSERT INTO transfers VALUES (?,?,?,?)",
            (f"cust{i}", "p1", rng.randint(50, 800), now - rng.uniform(3600, 30 * 86400)),
        )
    for i in range(8):  # mule: fast fan-in, then fans out to a known mule
        c.execute(
            "INSERT INTO transfers VALUES (?,?,?,?)",
            (f"victim{i}", "p2", rng.randint(5000, 90000), now - rng.uniform(60, 6 * 3600)),
        )
    for dst in ["mule_boss", "m_a", "m_b", "m_c", "m_d"]:
        c.execute("INSERT INTO transfers VALUES ('p2',?,40000,?)", (dst, now - 1800))
