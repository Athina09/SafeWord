# CLAUDE.md

SafeWord: APP-fraud prevention demo (RBI anti-fraud track). Full plan in `docs/plan.md`. The user is **Person A** (client and experience: M1–M6). Person B owns `backend/` and `data/` (now built too, at the user's request).

## Layout
- `android/` — Expo (React Native, TypeScript) app. Read `android/AGENTS.md` first: Expo APIs change per SDK, so check docs for the installed version before using them.
- `dashboard/` — React + Vite bank fraud-team dashboard (M6). `npm run dev`; `VITE_API_URL` (default http://localhost:8000), optional `VITE_CUSTOMER_PHONE`
- `api/openapi.yaml` — contract with Person B. Changes need both people's agreement; keep `android/src/api/types.ts` in sync.
- `backend/` — FastAPI bank simulator (`app/`: ledger, graph, workaround, risk, tiers, main), `train.py`, `metrics.py`, tests
- `data/` — `generate.py` (synthetic data + mule network), `export_tflite.py` (needs TensorFlow, untested)

## Commands (in `android/`)
```bash
npm install
npx expo start         # dev server; use a development build, not Expo Go, once native modules land
npx tsc --noEmit       # typecheck
```
Run on the emulator (Pixel_4a AVD): start the backend, then `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo run:android` (development build; `expo-dev-client` is installed so Expo Go is not used). Needs `ANDROID_HOME=~/Library/Android/sdk`. The first Gradle build failed once on a TLS handshake to dl.google.com behind the proxy; retrying succeeded. `android/android/` is generated native code.
Set `EXPO_PUBLIC_API_URL` to use Person B's server; unset uses the built-in stub in `src/api/client.ts`.

### Backend (Python 3.13 venv; 3.15 and 3.12 failed to create one here)
```bash
cd backend && source .venv/bin/activate
python ../data/generate.py && python train.py   # data + model + thresholds (already generated)
python -m pytest -q                              # the 5 demo scenarios end to end
python metrics.py                                # writes docs/metrics.json
uvicorn app.main:app --host 0.0.0.0 --port 8000  # then EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000 for a phone
```

## Rules
- **Duress rule:** the SafeWord PIN path must look identical to a normal pending payment everywhere (UI, timing, notifications, history). Never show a distinct state for it.
- Only scores and flags leave the phone; never raw behaviour or call data.
- Demo-only PINs: real PIN `1234` (`src/settings.ts`); the SafeWord PIN is registered in Settings (none by default).
- Every payment takes at least 1.2 s in the app so timing cannot reveal which PIN was used.
- Real vs demo signals and the untested Bhashini/TFLite pieces: `docs/native-signals.md`.
- Package manager: npm. Install Expo packages with `npx expo install`.
