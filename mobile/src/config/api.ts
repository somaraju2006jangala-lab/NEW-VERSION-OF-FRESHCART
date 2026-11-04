import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const STORAGE_API_URL_KEY = 'freshcart_custom_api_base_url';

// Environment variable configuration for Expo Go
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const ENV_LAN_IP = process.env.EXPO_PUBLIC_LAN_IP;
const ENV_PORT = process.env.EXPO_PUBLIC_PORT;

// Default LAN IP detected from dev server for physical phones on WiFi
export const DEFAULT_LAN_IP = ENV_LAN_IP || '10.211.209.237';
export const DEFAULT_PORT = ENV_PORT || '3000';

/**
 * Dynamically extract Metro dev server host if available on physical device
 */
function getDevServerHost(): string | null {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
      }
    }
    const scriptURL = (Platform.OS !== 'web' && (NativeModules as any)?.SourceCode?.scriptURL) || '';
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function getDefaultApiUrl(): string {
  // If running in browser (Expo Web), automatically match host IP/domain so devices on WiFi can connect
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:${DEFAULT_PORT}`;
    }
  }

  // Dynamic dev server host from Metro bundler on physical device
  const dynamicHost = getDevServerHost();
  if (dynamicHost) {
    return `http://${dynamicHost}:${DEFAULT_PORT}`;
  }

  // If explicitly configured via environment variable, use it
  if (ENV_API_URL && ENV_API_URL.trim()) {
    const trimmed = ENV_API_URL.trim().replace(/\/+$/, '');
    // For Android/iOS physical device, ensure localhost is not used
    if ((Platform.OS === 'android' || Platform.OS === 'ios') && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;
    }
    return trimmed;
  }

  return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;
}

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_API_URL_KEY);
    if (saved && saved.trim()) {
      const clean = saved.trim().replace(/\/+$/, '');
      // Sanity check: on physical Android/iOS, if the saved URL was localhost or 127.0.0.1, auto-correct it to LAN IP
      if ((Platform.OS === 'android' || Platform.OS === 'ios') && (clean.includes('localhost') || clean.includes('127.0.0.1'))) {
        cachedBaseUrl = getDefaultApiUrl();
        await AsyncStorage.setItem(STORAGE_API_URL_KEY, cachedBaseUrl);
        return cachedBaseUrl;
      }
      cachedBaseUrl = clean;
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
