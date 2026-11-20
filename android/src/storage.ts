import * as SecureStore from 'expo-secure-store';

// Secure storage can be unavailable (e.g. web); the app must still work without it.
export async function load(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function save(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore: setting stays in memory for this session
  }
}
