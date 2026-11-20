"""Tiered response (M12): low -> allow, medium -> voice prompt, high -> hold + trusted person."""

ORDER = {"allow": 0, "prompt": 1, "hold": 2}


def _max(a: str, b: str) -> str:
    return a if ORDER[a] >= ORDER[b] else b


def decide(prob: float, feats: dict, thresholds: dict) -> str:
    if prob >= thresholds["hold"]:
        decision = "hold"
    elif prob >= thresholds["prompt"]:
        decision = "prompt"
    else:
        decision = "allow"
    # Workaround rules are floors the model score cannot lower.
    if feats.get("split_detected"):
        decision = _max(decision, "hold" if feats["call_active"] else "prompt")
    if feats.get("whitelist_during_call") or feats.get("limit_raised_during_call"):
        decision = _max(decision, "prompt")
    return decision
