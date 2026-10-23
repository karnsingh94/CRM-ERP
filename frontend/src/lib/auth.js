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
  const getTabToken = (key) => {
    const tabToken = sessionStorage.getItem(key);
    if (tabToken) return tabToken;

    const persistedToken = localStorage.getItem(key);
    if (!persistedToken) return null;

    sessionStorage.setItem(key, persistedToken);
    localStorage.removeItem(key);
    return persistedToken;
  };

  const tokenKeys = isImpersonating
    ? ['azzuniqe_client_token', 'azzuniqe_super_token']
    : ['azzuniqe_super_token', 'azzuniqe_client_token'];
  return tokenKeys.map(getTabToken).find(Boolean) || null;
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

export function restoreSuperAdminSession() {
  if (typeof window === 'undefined') return false;

  const isImpersonating =
    localStorage.getItem('is_super_admin_impersonating') === 'true' ||
    sessionStorage.getItem('is_super_admin_impersonating') === 'true';
  const backupToken =
    localStorage.getItem('azzuniqe_super_token_backup') ||
    sessionStorage.getItem('azzuniqe_super_token_backup');

  if (!isImpersonating || !backupToken) return false;

  sessionStorage.setItem('azzuniqe_super_token', backupToken);
  for (const storage of [localStorage, sessionStorage]) {
    [
      'azzuniqe_super_token_backup',
      'azzuniqe_client_token',
      'company_user',
      'auth_user',
      'active_company_id',
      'cached_company_data',
      'is_super_admin_impersonating',
      'impersonated_client_name',
    ].forEach((key) => storage.removeItem(key));
  }

  cachedSessionUser = null;
  cachedSessionToken = null;
  cachedSessionAt = 0;
  inFlightSessionPromise = null;
  inFlightSessionToken = null;
  return true;
}

export function rememberVerifiedSession(token, user) {
  if (!token || !user) return;
  cachedSessionToken = token;
  cachedSessionUser = user;
  cachedSessionAt = Date.now();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('azzuniqe_login_redirect_pending');
  }
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

export function getCachedStoredUser() {
  if (!getStoredToken()) return null;

  for (const key of ['auth_user', 'company_user']) {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const user = parsed?.user || parsed?.data?.user || parsed?.data || parsed;
        if (
          user &&
          ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(user.role)
        ) {
          return user;
        }
      } catch {
        // Ignore malformed cached profiles and check the other storage entry.
      }
    }
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
