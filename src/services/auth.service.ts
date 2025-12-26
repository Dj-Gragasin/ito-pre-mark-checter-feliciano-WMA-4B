import axios from 'axios';
import { API_CONFIG } from '../config/api.config';

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to login');
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
    const res = await fetch(`${API_URL}/dev/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: devEmail }),
    });

    const json = await res.json();
    if (!res.ok || !json.success || !json.token) {
      console.warn('Dev token not available:', json);
      return null;
    }

    localStorage.setItem('token', json.token);
    if (json.user) localStorage.setItem('user', JSON.stringify(json.user));
    console.log('✅ Dev token stored for', devEmail);
    return json.token;
  } catch (err: any) {
    console.error('❌ ensureToken error', err);
    return null;
  }
};