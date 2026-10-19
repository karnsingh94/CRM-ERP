'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  const isImpersonating = localStorage.getItem('is_super_admin_impersonating') === 'true';
  if (isImpersonating) {
    return (
      localStorage.getItem('azzuniqe_client_token') ||
      sessionStorage.getItem('azzuniqe_client_token') ||
      localStorage.getItem('azzuniqe_super_token')
    );
  }
  return (
    localStorage.getItem('azzuniqe_super_token') ||
    localStorage.getItem('azzuniqe_client_token') ||
    sessionStorage.getItem('azzuniqe_super_token') ||
    sessionStorage.getItem('azzuniqe_client_token')
  );
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const isImpersonating = localStorage.getItem('is_super_admin_impersonating') === 'true';
  try {
    if (isImpersonating) {
      const compRaw = localStorage.getItem('company_user') || sessionStorage.getItem('company_user');
      if (compRaw) return JSON.parse(compRaw);
    }
    const superToken = localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token');
    if (superToken) {
      const superRaw = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      if (superRaw) {
        const u = JSON.parse(superRaw);
        if (u.role === 'SUPER_ADMIN' || u.role === 'Super Admin') return u;
      }
    }
    const clientRaw =
      localStorage.getItem('company_user') ||
      sessionStorage.getItem('company_user') ||
      localStorage.getItem('auth_user') ||
      sessionStorage.getItem('auth_user');
    return clientRaw ? JSON.parse(clientRaw) : null;
  } catch {
    return null;
  }
}

let cachedSessionUser = null;
let lastSessionVerifyTime = 0;
let inFlightSessionPromise = null;

export async function verifyCurrentSession(forceRefresh = false) {
  const now = Date.now();
  // Return cached session if verified within last 30 seconds and not forced
  if (!forceRefresh && cachedSessionUser && (now - lastSessionVerifyTime < 30000)) {
    return cachedSessionUser;
  }

  // Deduplicate concurrent calls
  if (inFlightSessionPromise && !forceRefresh) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = (async () => {
    const token = getStoredToken();
    try {
      if (token) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const verified = data?.data?.user || data?.data || null;
          if (verified) {
            cachedSessionUser = verified;
            lastSessionVerifyTime = Date.now();
            return verified;
          }
        }
      }
    } catch (err) {
      console.warn('Session verification network error:', err);
    } finally {
      inFlightSessionPromise = null;
    }

    const fallbackUser = getStoredUser();
    if (fallbackUser) {
      cachedSessionUser = fallbackUser;
      lastSessionVerifyTime = Date.now();
    }
    return fallbackUser;
  })();

  return inFlightSessionPromise;
}

export async function logoutUser() {
  const token = getStoredToken();
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => null);
  } catch {}

  cachedSessionUser = null;
  lastSessionVerifyTime = 0;
  inFlightSessionPromise = null;

  if (typeof window !== 'undefined') {
    localStorage.removeItem('azzuniqe_super_token');
    localStorage.removeItem('azzuniqe_super_token_backup');
    localStorage.removeItem('azzuniqe_client_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('company_user');
    localStorage.removeItem('active_company_id');
    localStorage.removeItem('cached_company_data');
    localStorage.removeItem('is_super_admin_impersonating');
    localStorage.removeItem('impersonated_client_name');
    sessionStorage.clear();
    document.cookie = 'azzuniqe_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    window.location.href = '/login';
  }
}
