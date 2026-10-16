'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('azzuniqe_super_token') ||
    localStorage.getItem('azzuniqe_client_token') ||
    sessionStorage.getItem('azzuniqe_super_token') ||
    sessionStorage.getItem('azzuniqe_client_token')
  );
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      localStorage.getItem('auth_user') ||
      localStorage.getItem('company_user') ||
      sessionStorage.getItem('auth_user') ||
      sessionStorage.getItem('company_user');
    return raw ? JSON.parse(raw) : null;
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
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        });
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
    localStorage.removeItem('azzuniqe_client_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('company_user');
    localStorage.removeItem('active_company_id');
    sessionStorage.clear();
    document.cookie = 'azzuniqe_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    window.location.href = '/login';
  }
}
