import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_API_URL_KEY = 'freshcart_custom_api_base_url';

// Default LAN IP detected from dev server for physical phones on WiFi
export const DEFAULT_LAN_IP = '10.211.209.237';
export const DEFAULT_PORT = '3000';

export function getDefaultApiUrl(): string {
  if (Platform.OS === 'android') {
    // For physical devices or emulator, LAN IP works across the local WiFi network
    return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_API_URL_KEY);
    if (saved && saved.trim()) {
      cachedBaseUrl = saved.trim().replace(/\/+$/, '');
      return cachedBaseUrl;
    }
  } catch {
    // ignore
  }
  cachedBaseUrl = getDefaultApiUrl();
  return cachedBaseUrl;
}

export async function setApiBaseUrl(newUrl: string): Promise<void> {
  const clean = newUrl.trim().replace(/\/+$/, '');
  cachedBaseUrl = clean;
  try {
    await AsyncStorage.setItem(STORAGE_API_URL_KEY, clean);
  } catch {
    // ignore
  }
}

export async function resetApiBaseUrl(): Promise<string> {
  const defaultUrl = getDefaultApiUrl();
  cachedBaseUrl = defaultUrl;
  try {
    await AsyncStorage.removeItem(STORAGE_API_URL_KEY);
  } catch {
    // ignore
  }
  return defaultUrl;
}
