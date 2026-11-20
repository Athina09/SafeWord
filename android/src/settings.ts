import { load, save } from './storage';

export type Lang = 'en' | 'hi' | 'ta';

export interface Settings {
  duressPin: string | null;
  lang: Lang;
  trustedName: string;
  trustedPhone: string;
}

export const REAL_PIN = '1234'; // demo-only test PIN

export const DEFAULT_SETTINGS: Settings = {
  duressPin: null,
  lang: 'en',
  trustedName: 'Ravi (son)',
  trustedPhone: '',
};

export async function loadSettings(): Promise<Settings> {
  const raw = await load('settings');
  try {
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const saveSettings = (s: Settings) => save('settings', JSON.stringify(s));
