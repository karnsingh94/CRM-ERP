'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const AUTH_STORAGE_KEYS = [
  'azzuniqe_super_token',
  'azzuniqe_super_token_backup',
  'azzuniqe_client_token',
  'auth_user',
  'company_user',
  'active_company_id',
  'cached_company_data',
  'is_super_admin_impersonating',
  'impersonated_client_name',
];

const SESSION_CACHE_MS = 30_000;
let cachedSessionUser = null;
let cachedSessionToken = null;
let cachedSessionAt = 0;
let inFlightSessionPromise = null;
let inFlightSessionToken = null;

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  const isImpersonating = localStorage.getItem('is_super_admin_impersonating') === 'true';
  if (isImpersonating) {
    return (
      localStorage.getItem('azzuniqe_client_token') ||
      sessionStorage.getItem('azzuniqe_client_token') ||
      localStorage.getItem('azzuniqe_super_token') ||
      sessionStorage.getItem('azzuniqe_super_token')
    );
  }
  return (
    localStorage.getItem('azzuniqe_super_token') ||
    sessionStorage.getItem('azzuniqe_super_token') ||
    localStorage.getItem('azzuniqe_client_token') ||
    sessionStorage.getItem('azzuniqe_client_token')
  );
}

export function clearStoredSession() {
  cachedSessionUser = null;
  cachedSessionToken = null;
  cachedSessionAt = 0;
  inFlightSessionPromise = null;
  inFlightSessionToken = null;

  if (typeof window === 'undefined') return;
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  document.cookie = 'azzuniqe_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
  document.cookie = 'azzuniqe_super_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
}

export function rememberVerifiedSession(token, user) {
  if (!token || !user) return;
  cachedSessionToken = token;
  cachedSessionUser = user;
  cachedSessionAt = Date.now();
}

export function getStoredUser() {
  const token = getStoredToken();
  const cacheAge = Date.now() - cachedSessionAt;
  if (
    token &&
    token === cachedSessionToken &&
    cacheAge >= 0 &&
    cacheAge < SESSION_CACHE_MS
  ) {
    return cachedSessionUser;
  }
  return null;
}

export async function verifyCurrentSession() {
  const token = getStoredToken();
  if (!token) {
    clearStoredSession();
    return null;
  }

  const cachedUser = getStoredUser();
  if (cachedUser) return cachedUser;

  if (inFlightSessionPromise && inFlightSessionToken === token) {
    return inFlightSessionPromise;
  }

  inFlightSessionToken = token;
  inFlightSessionPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 && getStoredToken() === token) clearStoredSession();
        return null;
      }

      const data = await res.json();
      const verified = data?.data?.user || data?.data || null;
      if (!verified || getStoredToken() !== token) return null;

      rememberVerifiedSession(token, verified);
      return verified;
    } catch (err) {
      console.warn('Session verification failed:', err);
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (inFlightSessionToken === token) {
        inFlightSessionPromise = null;
        inFlightSessionToken = null;
      }
    }
  })();

  return inFlightSessionPromise;
}
