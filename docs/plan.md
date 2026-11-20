# SafeWord — Build Plan (2 people)

Track 1: Digital Payments Fraud Detection and Prevention

**Goal:** a working demo with a labelled mock payment app, a simulated bank backend that holds money before it leaves, a risk engine on synthetic data, and a review dashboard for bank officers.

## How the work is split

The split follows one line: **Person A owns everything the user and bank officer see. Person B owns everything that decides and stores.** The two sides meet only at the API contract below, so both can work in parallel from day one.

| | Person A: Client & Experience | Person B: Bank Backend & Intelligence |
|---|---|---|
| Stack | React Native (Expo, TypeScript), TFLite, React, Bhashini | Python, FastAPI, XGBoost, SHAP, NetworkX |
| Modules | M1 Mock payment app<br>M2 On-device signal collector<br>M3 SafeWord PIN (duress) flow<br>M4 Voice prompts (Bhashini)<br>M5 Trusted-person approval screens<br>M6 Bank fraud-team dashboard | M7 Bank simulator & held-payment ledger<br>M8 Synthetic data generator<br>M9 Risk engine (XGBoost + SHAP)<br>M10 Mule-account graph features<br>M11 Scammer-workaround detector<br>M12 Tiered response & duress-alert service |
| Owns metrics | Elderly-user comprehension of warnings | False holds, scam scenarios caught, time to intervene |

---

## Shared work (both, day 1, before splitting)

- [ ] Agree on the **API contract** (below) and commit it as `api/openapi.yaml`
- [ ] Agree on the **signal payload** JSON schema the phone sends
- [ ] Write the **5 demo scam scripts** together (see Demo scenarios) — they drive both the data generator and the app flows
- [ ] Repo layout: `/android`, `/dashboard`, `/backend`, `/data`, `/docs`
- [ ] B stands up a stub FastAPI server returning fixed responses so A can build against it immediately

### API contract (draft)

| Endpoint | Caller | Purpose |
|---|---|---|
| `POST /payments/initiate` | App | Payee, amount, PIN type flag, device signals → returns `{decision: allow \| prompt \| hold, payment_id, reasons[], prompt_lang}` |
| `POST /payments/{id}/confirm` | App | User continues after a voice prompt |
| `POST /payments/{id}/cancel` | App | User cancels |
| `GET /payments/{id}/status` | App | Polls status (always shows "pending" for duress holds) |
| `POST /payees` / `PATCH /limits` | App | Whitelisting & limit changes (inputs to workaround detector) |
| `GET /approvals/pending` / `POST /approvals/{id}` | Trusted-person app | Family member approves / rejects |
| `GET /cases`, `GET /cases/{id}` | Dashboard | Held payments with risk score + SHAP reasons |
| `POST /cases/{id}/release` / `reverse` | Dashboard | Officer action (no auto-release on timer) |

**Duress rule (non-negotiable for both):** the SafeWord PIN path never calls the risk engine and never auto-releases. The app must show the identical "pending" UI; the backend must hold and alert.

---

## Person A — Client & Experience

> **Why React Native:** same language (TypeScript/React) as the dashboard, so A works in one stack. Use an **Expo development build** (not Expo Go) so native libraries for call state and TFLite can be added. If a native signal is hard to get working, keep a hidden **"demo signals" panel** in the app that toggles it on/off. The demo still works, and the real hook can be swapped in later.

### M1. Mock payment app (React Native)
- [ ] Clearly labelled "DEMO — not a real bank" UPI-style app
- [ ] Test accounts login, balance, payee list, send money, add payee, raise limit
- [ ] PIN entry screen (shared by real PIN and SafeWord PIN — must look the same)
- [ ] Payment states: success, pending, prompt, held-for-approval

### M2. On-device signal collector
- [ ] Active call detection via `react-native-call-detection` (needs `READ_PHONE_STATE`) + whether caller is in contacts (`expo-contacts`)
- [ ] Screen-recording / sharing detection: try an existing RN library first; if none fits Android 15, a small Expo native module is ~20 lines (copy from docs) **or** use the demo-signals toggle
- [ ] Behaviour features (all in TypeScript): typing speed, time-to-pay, hesitation, time of day vs user's history
- [ ] Consent screen explaining each signal in plain words
- [ ] On-device TFLite model via `react-native-fast-tflite` turns raw behaviour into a small anomaly score (B trains and exports the `.tflite` file); **only scores/flags leave the phone, never raw data**

### M3. SafeWord PIN flow
- [ ] Register a second PIN in settings (with explanation + practice mode)
- [ ] Entering it sends `pin_type=duress` and shows the normal "pending" screen
- [ ] No visible difference anywhere in the app (notifications, history, timing)

### M4. Voice prompts (Bhashini)
- [ ] Integrate Bhashini TTS for at least Hindi, English + 1 regional language; play audio with `expo-av`
- [ ] Short script-breaking prompts (e.g. "Police never ask you to move money to verify your name. Is someone on a call with you telling you to do this?")
- [ ] Prompt shows a pause + "Call my family" button, not just "Continue"

### M5. Trusted-person approval
- [ ] Senior user picks a family member in advance
- [ ] Second app mode (or simple web page, reusing dashboard components) for the family member to approve/reject with reasons shown

### M6. Bank fraud-team dashboard (React)
- [ ] Live queue of held payments, sorted by risk / duress first
- [ ] Case view: risk score, plain-language SHAP reasons, signal timeline, payee graph snapshot
- [ ] Actions: release, reverse, call customer, export cybercrime-portal report (structured)
- [ ] Duress alerts highlighted with "golden hour" countdown

### A — Done means
- All 5 demo scenarios can be clicked through end-to-end on a real Android phone
- Run a small comprehension test with 5+ elderly users on the voice prompts and record results

---

## Person B — Bank Backend & Intelligence

### M7. Bank simulator & held-payment ledger (FastAPI)
- [ ] Accounts, balances, payees, limits (SQLite/Postgres)
- [ ] Ledger states: `initiated → allowed | prompted | held → released | reversed`
- [ ] Money is debited to a **hold** state before leaving; nothing settles until allowed/released
- [ ] Audit log of every decision with reasons (the bank's "clear record")

### M8. Synthetic data generator
- [ ] Normal user behaviour: salaries, bills, small UPI payments, by persona (senior, rural first-timer, urban)
- [ ] Scam sessions from the 5 demo scripts: digital-arrest, investment, KYC update, etc.
- [ ] Mule networks: new accounts with fast fan-in / fan-out
- [ ] Labelled dataset in `/data`, plus a held-out test set for metrics
- [ ] Train a tiny behaviour-anomaly model and export it as `.tflite` for A's on-device scoring (M2)

### M9. Risk engine
- [ ] Feature pipeline: device signals + behaviour score + amount (₹10,000 threshold awareness) + payee features + graph features
- [ ] XGBoost model, trained on M8 data
- [ ] SHAP explanations mapped to plain-language reasons ("You are on a call with an unknown number", "This account was opened 3 days ago")
- [ ] Thresholds for low / medium / high tuned to minimise false holds

### M10. Mule-account graph features (NetworkX)
- [ ] Build transaction graph from ledger
- [ ] Features: account age, in-degree velocity, fan-out ratio, hops to known mule
- [ ] Note how this would plug into RBIH MuleHunter.AI / DPIP in real deployment

### M11. Scammer-workaround detector
- [ ] Rules + features for: new payee whitelisted during an active call, payment split into sub-₹10,000 chunks to same payee, limit raised during a call
- [ ] Session window so split payments are scored together, not one by one

### M12. Tiered response & duress-alert service
- [ ] Decision logic: low → allow, medium → voice prompt, high → hold + trusted-person request
- [ ] Duress path: bypasses model, immediate hold, alert to fraud team queue, no timer release
- [ ] Notification hooks (trusted person, fraud team)

### B — Done means
- API matches the contract and passes A's integration tests
- Metrics report: false-hold rate on genuine payments, % scripted scams caught, median time to intervene

---

## Phases

| Phase | Person A | Person B | Sync point |
|---|---|---|---|
| **1. Foundations** | M1 app skeleton, PIN screen, consent screen | M7 ledger + stub API, M8 data generator v1 | App sends a payment to stub API and gets a fake decision |
| **2. Core logic** | M2 signals, M3 duress PIN | M9 model v1, M11 workaround rules, M12 tiers | Real decisions flow back to the app; duress path works end-to-end |
| **3. Response layer** | M4 voice prompts, M5 trusted-person flow | M10 graph features, SHAP reason text | Medium/high-risk flows complete on the phone |
| **4. Bank view** | M6 dashboard | Case APIs, audit log, cybercrime report export | Officer can release/reverse a held payment |
| **5. Polish & measure** | Elderly comprehension test, UI polish | Threshold tuning, metrics report | Full demo rehearsal, both present |

Daily 15-min check-in; any change to the API contract must be agreed by both before merging.

---

## Demo scenarios (shared test cases)

1. **Normal payment** — ₹500 to a known shop → goes through, no friction
2. **Digital arrest** — video call active, new payee, ₹2 lakh → high risk → hold + family approval
3. **Split to dodge threshold** — 6 × ₹9,500 to a new payee during a call → workaround detected → hold
4. **Whitelist trick** — payee added and limit raised during an unknown call → medium/high → voice prompt
5. **Silent SOS** — user enters SafeWord PIN → "pending" screen, bank holds, fraud team alerted instantly

## Final deliverables

- [ ] Android APK built with EAS Build (A)
- [ ] Dashboard build (A)
- [ ] Backend + model + data generator (B)
- [ ] Metrics report (B, with A's comprehension results)
- [ ] Demo video + slides (both)
