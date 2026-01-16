import { API_CONFIG } from '../config/api.config';
import { Capacitor } from '@capacitor/core';

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    let data: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  } catch (error: any) {
    const isNative = Capacitor.isNativePlatform();
    const isLikelyFetchFailure =
      error?.name === 'TypeError' &&
      typeof error?.message === 'string' &&
      error.message.toLowerCase().includes('fetch');

    if (isLikelyFetchFailure) {
      const base = API_CONFIG.BASE_URL;
      const localhostHint = base.includes('localhost') || base.includes('127.0.0.1');

      const nativeHint = isNative
        ? (localhostHint
            ?
              "You're using a localhost API URL, but inside the APK 'localhost' means your PHONE (not your PC/server).\n\n" +
              "Fix: rebuild the APK with REACT_APP_API_URL set to your server's reachable IP/domain, e.g. http://192.168.1.10:3002/api or https://YOUR-SERVICE/api."
            :
              "If this is a local/LAN server, make sure your phone and server are on the same Wi‑Fi and the port is reachable.")
        : "If you're in a browser, ensure the API URL is reachable and (if using camera) served from https/localhost.";

      throw new Error(
        `Network error: Failed to reach API.\n\nAPI: ${base}\n\n${nativeHint}`
      );
    }

    throw new Error(error?.message || 'Failed to login');
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * ensureToken() - verifies a token; in dev it can auto-create a token for a test user.
 * - If token exists, returns it.
 * - If not, and in development, requests /api/dev/token to get a test token and user.
 */
export const ensureToken = async (options?: { devEmail?: string }): Promise<string | null> => {
  const existing = getToken();
  if (existing) return existing;

  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const devEmail = options?.devEmail || 'member@activecore.com';
    const res = await fetch(`${API_CONFIG.BASE_URL}/dev/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: devEmail }),
    });

    const json = await res.json();
    if (!res.ok || !json.success || !json.token) {
      return null;
    }

    localStorage.setItem('token', json.token);
    if (json.user) localStorage.setItem('user', JSON.stringify(json.user));
    return json.token;
  } catch (err: any) {
    return null;
  }
};