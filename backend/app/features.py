"""Feature definitions shared by the API, the data generator and training (single source of truth)."""
import math

THRESHOLD = 10_000  # RBI's proposed delay/approval threshold (INR)

FEATURES = [
    "call_active",
    "caller_unknown",
    "screen_shared",
    "behaviour_anomaly",
    "night",
    "amount_log",
    "over_10k",
    "payee_age_days",
    "payee_is_new",
    "in_velocity",
    "fan_out_ratio",
    "hops_to_mule",
    "split_count",
    "session_total_log",
    "whitelist_during_call",
    "limit_raised_during_call",
]

# Plain-language reason for each feature. Only shown when SHAP says the feature pushed risk up.
REASONS = {
    "call_active": "You are on a phone call while making this payment",
    "caller_unknown": "You are on a call with a number that is not in your contacts",
    "screen_shared": "Your screen is being recorded or shared",
    "behaviour_anomaly": "You are paying differently from your usual habits",
    "night": "This payment is at an unusual hour",
    "amount_log": "This is a large payment",
    "over_10k": "This payment is above ₹10,000",
    "payee_age_days": "The receiving account was opened only a few days ago",
    "payee_is_new": "You have never paid this person before",
    "in_velocity": "The receiving account is getting money from many accounts very quickly",
    "fan_out_ratio": "The receiving account passes money on very quickly",
    "hops_to_mule": "The receiving account is linked to accounts flagged for fraud",
    "split_count": "This payment looks like part of a larger amount split into smaller ones",
    "session_total_log": "A large total is being sent to this person in a short time",
    "whitelist_during_call": "This payee was added during the same phone call",
    "limit_raised_during_call": "Your payment limit was raised during a phone call",
}


def is_night(hour: int) -> int:
    return int(hour >= 23 or hour <= 5)


def vector(f: dict) -> list[float]:
    """Ordered model input from a feature dict."""
    return [float(f[name]) for name in FEATURES]


def amount_features(amount: float, session_total: float) -> dict:
    return {
        "amount_log": math.log10(max(amount, 1.0)),
        "over_10k": int(amount >= THRESHOLD),
        "session_total_log": math.log10(max(session_total, 1.0)),
    }


# Short labels for the dashboard's "why was this flagged" chart.
LABELS = {
    "call_active": "On a call",
    "caller_unknown": "Unknown caller",
    "screen_shared": "Screen shared",
    "behaviour_anomaly": "Unusual behaviour",
    "night": "Odd hour",
    "amount_log": "Amount size",
    "over_10k": "Over ₹10,000",
    "payee_age_days": "New receiving account",
    "payee_is_new": "First-time payee",
    "in_velocity": "Fast inflow to payee",
    "fan_out_ratio": "Payee forwards money",
    "hops_to_mule": "Near known mule",
    "split_count": "Split payments",
    "session_total_log": "Session total",
    "whitelist_during_call": "Payee added on call",
    "limit_raised_during_call": "Limit raised on call",
}
