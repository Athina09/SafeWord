# SafeWord

Making RBI's anti-fraud safeguards smarter for people being scammed in real time.
*Track 1: Digital Payments Fraud Detection and Prevention.*

> **DEMO ONLY.** Everything here runs on test accounts and synthetic data. There is no real bank, no real money and no real payment network.

## The problem

In an Authorised Push Payment (APP) scam the victim unlocks their own phone, enters their own UPI PIN and sends the money. Nothing is hacked, so every security check passes. RBI's proposed one-hour delay and trusted-person approval for transfers above ₹10,000 treat everyone the same, and scammers get around them by telling the victim to whitelist the scammer's account or split the amount. A person being watched on a call still has no quiet way to ask for help.

## What SafeWord does

SafeWord sits inside the bank's payment flow and decides when the safeguards are really needed.

1. **Reads the situation.** With consent, it looks at phone signals (active call, screen sharing, how the person is typing and paying compared with their habits) and at the receiving account (how new it is, how fast money is pouring in). It turns them into a risk score with reasons in plain words.
2. **Spots the scammer's workarounds.** Whitelisting a new payee, raising a limit, or splitting a payment into chunks under ₹10,000 during a call is treated as a strong warning sign. Split payments are scored together as a session.
3. **Responds in steps.**
   - Low risk: the payment goes through.
   - Medium risk: a short voice prompt in the user's language breaks the scammer's script, with a pause and a "Call my family" button.
   - High risk: the bank holds the payment and a family member chosen in advance is asked to approve it.
4. **Gives a silent way to call for help.** The user registers a second "SafeWord PIN". Entering it shows the normal "pending" screen while the bank holds the money and alerts its fraud team. This path never calls the risk model and is never released just because a timer ran out.

## Repository layout

| Folder | What it is |
|---|---|
| `android/` | Expo (React Native, TypeScript) mock payment app: consent, login, send money, PIN pad, SafeWord PIN settings, voice prompts, family-approval mode |
| `backend/` | FastAPI bank simulator: held-payment ledger, XGBoost + SHAP risk engine, NetworkX mule-graph features, workaround detector, tiered response, tests |
| `dashboard/` | React + Vite fraud-team dashboard: live queue, risk gauge, "why it was flagged" chart, payee network graph, release/reverse, cybercrime report export |
| `data/` | Synthetic data generator, mule network, on-device model export script |
| `api/openapi.yaml` | The contract between the app/dashboard and the backend (draft) |
| `docs/` | Build plan, metrics report, notes on native signals |

## Quick start

You need Node 18+, Python 3.13 and (for the phone app) Android Studio with an emulator.

### 1. Backend

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python ../data/generate.py && python train.py   # only needed to regenerate data/model (both are committed)
python -m pytest -q                              # the five demo scenarios, end to end
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev          # http://localhost:5173
```

Settings: `VITE_API_URL` (default `http://localhost:8000`), optional `VITE_CUSTOMER_PHONE` for the "Call customer" button.

### 3. Phone app

```bash
cd android
npm install
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo run:android   # emulator reaches the host at 10.0.2.2
```

For a physical phone use your computer's LAN IP instead of `10.0.2.2`. The app uses a development build (`expo-dev-client`), not Expo Go. Without `EXPO_PUBLIC_API_URL` it runs against a small built-in stub.

Demo PINs: normal PIN `1234`. Register the SafeWord PIN yourself in **Settings**.

**Demo signals panel:** long-press the orange "DEMO" banner to set call active, caller in contacts, screen shared and the behaviour level.

## The five demo scenarios

| # | Scenario | Expected result |
|---|---|---|
| 1 | Normal payment: ₹500 to a known shop | Goes through, no friction |
| 2 | Digital arrest: video call, new payee, ₹2 lakh | High risk: held, family approval requested |
| 3 | Split to dodge the threshold: payments just under ₹10,000 to one payee during a call | Workaround detected: held |
| 4 | Whitelist trick: payee added and limit raised during an unknown call | Voice prompt or hold |
| 5 | Silent SOS: SafeWord PIN | Phone shows "pending"; bank holds the money and alerts the fraud team |

Scenarios 1 to 5 are covered by `backend/tests/test_scenarios.py`. On the emulator I have run scenarios 1 and 5 end to end against the live backend.

## How it fits together

```
 Phone app (React Native) ──signals + payment──▶ FastAPI bank simulator ◀── Fraud-team dashboard (React)
   • behaviour scored on device                    • ledger: balance → hold → settle/refund
   • consent, voice prompts, family mode           • risk engine: XGBoost + SHAP reasons
   • SafeWord PIN (looks like "pending")           • mule graph + session-based workaround rules
                                                   • tiers: allow / prompt / hold; duress bypasses the model
```

Only scores and flags leave the phone, never raw behaviour or call data. Money moves to a hold before it leaves the bank, and every decision is written to an audit log.

## Status and honest limitations

- **Metrics are from synthetic data.** On the held-out synthetic test set the model holds almost no genuine payments and catches almost every scripted scam (`docs/metrics.json`). The synthetic classes separate very easily, so treat this as a check that the pipeline works, not as real-world accuracy.
- **Call detection and screen-share detection are demo toggles.** Real hooks need small native modules. See `docs/native-signals.md`.
- **The behaviour model is a heuristic stand-in.** `data/export_tflite.py` trains and exports the real `.tflite` model but needs TensorFlow and has not been run.
- **Bhashini voice is untested.** It needs credentials (`EXPO_PUBLIC_BHASHINI_USER_ID`, `EXPO_PUBLIC_BHASHINI_API_KEY`) and falls back to on-device speech. The Hindi and Tamil prompt text needs review by native speakers.
- **Not yet tested on the phone:** the voice-prompt screen, the family-approval screen and the high-risk hold flow. The elderly-user comprehension study has not been run.
- **Real deployment** would need bank and NPCI integration, and would plug into RBIH's MuleHunter.AI and the Digital Payment Intelligence Platform instead of the simulator's own graph.

## Built on existing work

RBI's proposed delays and trusted-person checks, RBIH's MuleHunter.AI, and the duress PINs already used in some crypto hardware wallets. SafeWord adds risk-adaptive safeguards, detection of the coaching tricks scammers use to get around them, and one workflow joining a discreet distress signal, explainable risk scoring and bank-side holds.
