import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

import type { Lang } from './settings';

// Script-breaking prompts. Hindi and Tamil text should be reviewed by native speakers before the
// elderly-comprehension test.
export const PROMPTS: Record<Lang, string> = {
  en: 'Please pause. Police and banks never ask you to move money to verify your name. Is someone on a call with you telling you to do this? If yes, stop and call your family.',
  hi: 'कृपया रुकिए। पुलिस और बैंक कभी आपसे नाम सत्यापित करने के लिए पैसे भेजने को नहीं कहते। क्या कोई फ़ोन पर आपसे यह करवा रहा है? अगर हाँ, तो रुकिए और अपने परिवार को फ़ोन कीजिए।',
  ta: 'தயவுசெய்து நிறுத்துங்கள். காவல்துறையும் வங்கிகளும் உங்கள் பெயரை சரிபார்க்க பணம் அனுப்ப ஒருபோதும் கேட்காது. யாராவது தொலைபேசியில் உங்களை இதைச் செய்யச் சொல்கிறார்களா? ஆம் என்றால் நிறுத்தி, உங்கள் குடும்பத்தினரை அழையுங்கள்.',
};

export const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' };
const BCP47: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN' };

const USER_ID = process.env.EXPO_PUBLIC_BHASHINI_USER_ID;
const API_KEY = process.env.EXPO_PUBLIC_BHASHINI_API_KEY;
const PIPELINE_ID = '64392f96daac500b55c543cd'; // Bhashini's public TTS pipeline
const CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';

// Bhashini ULCA pipeline: 1) look up the TTS service for the language, 2) synthesise, 3) play the WAV.
// UNTESTED: needs real Bhashini credentials. Any failure falls back to on-device speech.
async function bhashiniSpeak(lang: Lang, text: string): Promise<void> {
  const cfg = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', userID: USER_ID!, ulcaApiKey: API_KEY! },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: lang } } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }),
  }).then((r) => r.json());
  const url = cfg.pipelineInferenceAPIEndPoint.callbackUrl;
  const key = cfg.pipelineInferenceAPIEndPoint.inferenceApiKey;
  const serviceId = cfg.pipelineResponseConfig[0].config[0].serviceId;

  const out = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [key.name]: key.value },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: lang }, serviceId, gender: 'female' } }],
      inputData: { input: [{ source: text }] },
    }),
  }).then((r) => r.json());
  const b64: string = out.pipelineResponse[0].audio[0].audioContent;

  const file = new File(Paths.cache, `prompt-${lang}.wav`);
  if (file.exists) file.delete();
  file.create();
  file.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const player = createAudioPlayer(file.uri);
  player.play();
}

export async function speakPrompt(lang: Lang): Promise<void> {
  const text = PROMPTS[lang];
  if (USER_ID && API_KEY) {
    try {
      await bhashiniSpeak(lang, text);
      return;
    } catch {
      // fall through to device TTS
    }
  }
  Speech.stop();
  Speech.speak(text, { language: BCP47[lang], rate: 0.9 });
}

export function stopSpeaking() {
  Speech.stop();
}
