"""Mule-account graph features (M10) from the transfer ledger.

In a real deployment these would come from RBIH MuleHunter.AI / the Digital Payment Intelligence
Platform (DPIP); here they are computed from the simulator's own transfers.
"""
import sqlite3
import time

import networkx as nx

DAY = 86400
MAX_HOPS = 6


def build_graph(c: sqlite3.Connection) -> nx.DiGraph:
    g = nx.DiGraph()
    for r in c.execute("SELECT src, dst, ts FROM transfers"):
        g.add_edge(r["src"], r["dst"])
        g[r["src"]][r["dst"]].setdefault("ts", []).append(r["ts"])
    return g


def payee_features(c: sqlite3.Connection, payee_id: str) -> dict:
    g = build_graph(c)
    payee = c.execute("SELECT * FROM payees WHERE id=?", (payee_id,)).fetchone()
    now = time.time()

    in_velocity = 0
    if payee_id in g:  # distinct senders in the last 24h
        in_velocity = sum(1 for s in g.predecessors(payee_id) if any(now - t < DAY for t in g[s][payee_id]["ts"]))
        fan_out = g.out_degree(payee_id) / max(g.in_degree(payee_id), 1)
    else:
        fan_out = 0.0

    mules = {r["id"] for r in c.execute("SELECT id FROM payees WHERE known_mule=1")}
    hops = MAX_HOPS
    if payee_id in mules:
        hops = 0
    elif payee_id in g:
        und = g.to_undirected(as_view=True)
        for m in mules & set(g.nodes):
            try:
                hops = min(hops, nx.shortest_path_length(und, payee_id, m))
            except nx.NetworkXNoPath:
                pass
    return {
        "payee_age_days": float(payee["acct_opened_days_ago"]),
        "in_velocity": float(in_velocity),
        "fan_out_ratio": float(fan_out),
        "hops_to_mule": float(min(hops, MAX_HOPS)),
    }


def snapshot(c: sqlite3.Connection, payee_id: str) -> dict:
    """Small neighbourhood of the payee for the dashboard's payee-graph view."""
    g = build_graph(c)
    if payee_id not in g:
        return {"nodes": [payee_id], "edges": []}
    sub = nx.ego_graph(g.to_undirected(as_view=True), payee_id, radius=1)
    mules = {r["id"] for r in c.execute("SELECT id FROM payees WHERE known_mule=1")}
    nodes = [{"id": n, "known_mule": n in mules, "is_payee": n == payee_id} for n in sub.nodes]
    edges = [{"src": s, "dst": d} for s, d in g.edges if s in sub and d in sub]
    return {"nodes": nodes, "edges": edges}
