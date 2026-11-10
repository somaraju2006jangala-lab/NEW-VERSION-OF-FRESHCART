import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const STORAGE_API_URL_KEY = 'freshcart_custom_api_base_url';

// Read optional static config from app.json extra without requiring uninstalled Expo packages
let appExtra: Record<string, any> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const appJson = require('../../app.json');
  appExtra = (appJson && (appJson.expo?.extra || appJson.extra)) || {};
} catch {
  appExtra = {};
}

const IS_DEV =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

// Clean separation of environment configuration for dev vs production
const ENV_PROD_URL = String(
  process.env.EXPO_PUBLIC_PROD_API_URL || appExtra.prodApiUrl || ''
).trim();
const ENV_API_URL = String(
  process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    appExtra.apiUrl ||
    ''
).trim();
const ENV_LAN_IP = String(
  process.env.EXPO_PUBLIC_LAN_IP || appExtra.lanIp || ''
).trim();
const ENV_PORT = String(
  process.env.EXPO_PUBLIC_PORT || appExtra.port || ''
).trim();

// Active Mac LAN IP fallback for physical devices on local Wi-Fi
export const DEFAULT_LAN_IP = ENV_LAN_IP || '10.240.114.237';
export const DEFAULT_PORT = ENV_PORT || '3000';

export function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

export function extractHostname(url: string): string | null {
  try {
    const match = url.trim().match(/^(?:https?|exp):\/\/([^:/?#]+)/i);
    if (match && match[1]) {
      return match[1].replace(/^\[|\]$/g, '').toLowerCase();
    }
  } catch {
    // ignore
  }
  return null;
}

export function isLoopbackHost(host?: string | null): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h === 'localhost.localdomain'
  );
}

export function isTunnelHost(host?: string | null): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return (
    h.endsWith('.exp.direct') ||
    h.includes('.ngrok') ||
    h === 'u.expo.dev' ||
    h.endsWith('.expo.dev') ||
    h.endsWith('.expo.io') ||
    h.endsWith('.loca.lt') ||
    h.endsWith('.trycloudflare.com')
  );
}

export function isPrivateLanHost(host?: string | null): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  if (h === '10.0.2.2') return false; // Android emulator host alias
  if (h.startsWith('192.168.') || h.startsWith('10.') || h.endsWith('.local')) {
    return true;
  }
  const match172 = h.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const octet = Number(match172[1]);
    return octet >= 16 && octet <= 31;
  }
  return false;
}

export function isProductionHttpsUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = normalizeBaseUrl(url);
  if (!clean.toLowerCase().startsWith('https://')) return false;
  const host = extractHostname(clean);
  if (!host) return false;
  return (
    !isLoopbackHost(host) &&
    !isPrivateLanHost(host) &&
    host !== '10.0.2.2' &&
    !isTunnelHost(host)
  );
}

/**
 * Dynamically extracts the Metro dev server LAN host on physical devices in dev mode.
 * Rejects loopback addresses and Expo tunnel domains (which do not forward port 3000).
 */
export function getDevServerHost(): string | null {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      const hostname = (window.location.hostname || '').trim().toLowerCase();
      if (hostname && !isLoopbackHost(hostname) && !isTunnelHost(hostname)) {
        return hostname;
      }
      return null;
    }

    if (!IS_DEV) {
      return null;
    }

    const scriptURL = String((NativeModules as any)?.SourceCode?.scriptURL || '');
    if (scriptURL) {
      const host = extractHostname(scriptURL);
      if (host && !isLoopbackHost(host) && !isTunnelHost(host)) {
        return host;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolves the default API base URL cleanly separating development vs production builds.
 */
export function getDefaultApiUrl(): string {
  const cleanProdUrl = normalizeBaseUrl(ENV_PROD_URL);
  const cleanEnvUrl = normalizeBaseUrl(ENV_API_URL);

  // 1. Production / Release builds: prefer explicit production URL; never probe Metro host
  if (!IS_DEV) {
    if (cleanProdUrl) {
      const prodHost = extractHostname(cleanProdUrl);
      if (prodHost && (Platform.OS === 'web' || !isLoopbackHost(prodHost))) {
        return cleanProdUrl;
      }
    }
    if (cleanEnvUrl) {
      const envHost = extractHostname(cleanEnvUrl);
      if (envHost && (Platform.OS === 'web' || !isLoopbackHost(envHost))) {
        return cleanEnvUrl;
      }
    }
  }

  // 2. If ENV_API_URL is explicitly configured to a production HTTPS domain, never overwrite it
  if (isProductionHttpsUrl(cleanEnvUrl)) {
    return cleanEnvUrl;
  }

  // 3. Web browser in development: match browser host IP so phones/tabs on Wi-Fi stay aligned
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = (window.location.hostname || '').trim().toLowerCase();
    if (hostname && !isLoopbackHost(hostname) && !isTunnelHost(hostname)) {
      return `http://${hostname}:${DEFAULT_PORT}`;
    }
    if (cleanEnvUrl && !isTunnelHost(extractHostname(cleanEnvUrl))) {
      return cleanEnvUrl;
    }
    return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;
  }

  // 4. Native Android/iOS in __DEV__: prefer live Metro LAN host (immune to .env caching & Wi-Fi IP changes)
  const dynamicHost = getDevServerHost();
  if (dynamicHost) {
    return `http://${dynamicHost}:${DEFAULT_PORT}`;
  }

  // 5. Fallback to explicit ENV_API_URL if safe for native device
  if (cleanEnvUrl) {
    const envHost = extractHostname(cleanEnvUrl);
    if (envHost && !isLoopbackHost(envHost) && !isTunnelHost(envHost)) {
      return cleanEnvUrl;
    }
  }

  // 6. Final dev LAN fallback
  return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`;
}

/**
 * Returns ordered, unique candidate dev URLs for LAN auto-heal fallback in __DEV__ mode.
 */
export function getCandidateDevUrls(): string[] {
  if (!IS_DEV) return [];

  const candidates: string[] = [];
  const pushUnique = (url?: string | null) => {
    if (!url) return;
    const clean = normalizeBaseUrl(url);
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return;
    const host = extractHostname(clean);
    if (!host || isTunnelHost(host)) return;
    if (Platform.OS !== 'web' && isLoopbackHost(host)) return;
    if (!candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  const dynamicHost = getDevServerHost();
  if (dynamicHost) {
    pushUnique(`http://${dynamicHost}:${DEFAULT_PORT}`);
  }
  if (ENV_API_URL) {
    pushUnique(ENV_API_URL);
  }
  pushUnique(`http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`);

  return candidates;
}

let cachedBaseUrl: string | null = null;

export function invalidateCachedBaseUrl(): void {
  cachedBaseUrl = null;
}

export interface HealthProbeResult {
  ok: boolean;
  status?: number;
  database?: string;
  productCount?: number;
  latencyMs?: number;
  error?: string;
}

/**
 * Probes /api/health and validates JSON payload & MySQL readiness.
 */
export async function probeBackendHealth(
  url: string,
  timeoutMs = 7000
): Promise<HealthProbeResult> {
  const clean = normalizeBaseUrl(url);
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${clean}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<')) {
      return {
        ok: false,
        status: res.status,
        latencyMs: Date.now() - startedAt,
        error: 'Server returned HTML instead of FreshCart JSON API',
      };
    }

    let json: any = null;
    try {
      json = trimmed ? JSON.parse(trimmed) : null;
    } catch {
      return {
        ok: false,
        status: res.status,
        latencyMs: Date.now() - startedAt,
        error: 'Invalid JSON response from server',
      };
    }

    const dbState = json?.database;
    const isHealthy = Boolean(
      res.ok &&
        json &&
        json.status === 'ok' &&
        dbState !== 'disconnected'
    );

    return {
      ok: isHealthy,
      status: res.status,
      database: dbState,
      productCount: typeof json?.productCount === 'number' ? json.productCount : undefined,
      latencyMs: Date.now() - startedAt,
      error: isHealthy
        ? undefined
        : dbState === 'disconnected'
        ? 'Backend server reachable, but MySQL database is disconnected'
        : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error:
        err?.name === 'AbortError'
          ? 'Connection timed out'
          : err?.message || 'Cannot reach server',
    };
  }
}

/**
 * Quick check whether a given backend URL responds healthily to /api/health.
 */
export async function testBackendHealth(url: string, timeoutMs = 7000): Promise<boolean> {
  const result = await probeBackendHealth(url, timeoutMs);
  return result.ok;
}

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const defaultUrl = getDefaultApiUrl();

  try {
    const saved = await AsyncStorage.getItem(STORAGE_API_URL_KEY);
    if (saved && saved.trim()) {
      const clean = normalizeBaseUrl(saved);
      const savedHost = extractHostname(clean);
      const hasValidScheme =
        clean.toLowerCase().startsWith('http://') ||
        clean.toLowerCase().startsWith('https://');

      if (!hasValidScheme || !savedHost || isTunnelHost(savedHost)) {
        cachedBaseUrl = defaultUrl;
        await AsyncStorage.setItem(STORAGE_API_URL_KEY, cachedBaseUrl);
        return cachedBaseUrl;
      }

      // Never allow loopback saved URLs on native devices
      if (Platform.OS !== 'web' && isLoopbackHost(savedHost)) {
        cachedBaseUrl = defaultUrl;
        await AsyncStorage.setItem(STORAGE_API_URL_KEY, cachedBaseUrl);
        return cachedBaseUrl;
      }

      // Always preserve valid production HTTPS URLs across restarts
      if (isProductionHttpsUrl(clean)) {
        cachedBaseUrl = clean;
        return cachedBaseUrl;
      }

      // In production builds, reject leftover local LAN IPs when a production default URL is configured
      if (
        !IS_DEV &&
        isProductionHttpsUrl(defaultUrl) &&
        (isPrivateLanHost(savedHost) || savedHost === '10.0.2.2')
      ) {
        cachedBaseUrl = defaultUrl;
        await AsyncStorage.setItem(STORAGE_API_URL_KEY, cachedBaseUrl);
        return cachedBaseUrl;
      }

      // In dev mode on physical devices, invalidate stale LAN IPs when Metro/LAN IP changes
      if (IS_DEV && Platform.OS !== 'web' && isPrivateLanHost(savedHost)) {
        const dynamicHost = getDevServerHost();
        const activeHost = dynamicHost || DEFAULT_LAN_IP;
        if (activeHost && savedHost !== activeHost.toLowerCase()) {
          cachedBaseUrl = defaultUrl;
          await AsyncStorage.setItem(STORAGE_API_URL_KEY, cachedBaseUrl);
          return cachedBaseUrl;
        }
      }

      cachedBaseUrl = clean;
      return cachedBaseUrl;
    }
  } catch {
    // ignore storage errors and fall back cleanly
  }

  cachedBaseUrl = defaultUrl;
  return cachedBaseUrl;
}

export async function setApiBaseUrl(newUrl: string): Promise<void> {
  const clean = normalizeBaseUrl(newUrl);
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
