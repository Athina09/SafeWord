# Native signals: what is real and what is a demo toggle

Person A, M2. The demo works end to end on the demo-signals panel (long-press the orange DEMO banner).

| Signal | Status | What is needed |
|---|---|---|
| Behaviour features (typing speed, time to pay, hesitation, hour vs usual) | **Real**, measured in `src/collector.ts` | Pick "live" in the panel to send the measured score instead of a preset |
| Behaviour anomaly **model** | Stand-in heuristic (`scoreBehaviour`) with the same 4 inputs/1 output | Run `data/export_tflite.py` (needs `pip install tensorflow`), then add `react-native-fast-tflite` and load `assets/behaviour_anomaly.tflite` in a development build |
| Active call | **Demo toggle only** | `react-native-call-detection` imports `react-native/Libraries/BatchedBridge`, which is likely broken on RN 0.88, so it was not installed. Use a small Expo native module around `TelephonyManager`/`PhoneStateListener` (`READ_PHONE_STATE` is already requested at consent) |
| Caller in contacts | Demo toggle; `src/contacts.ts` matches a number against contacts once a call provider supplies one | Call provider above |
| Screen sharing/recording | **Demo toggle only** | Android 15 `Activity.ScreenCaptureCallback`/`WindowManager` screen-recording callback via a ~20-line Expo native module |
| Bhashini TTS | Written, **untested** (`src/voice.ts`) | Set `EXPO_PUBLIC_BHASHINI_USER_ID` and `EXPO_PUBLIC_BHASHINI_API_KEY`; falls back to on-device speech (`expo-speech`) when unset or on any error |

None of the native pieces can run in Expo Go. Build a development client: `eas build --profile development --platform android`.
