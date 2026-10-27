/**
 * AZZUNIQE CRM & ERP — Company Admin API Client
 * Centralized HTTP client reusing the existing backend API conventions.
 */

import { clearStoredSession, getStoredToken } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const inFlightGetRequests = new Map();
const readResponseCache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds safe TTL for eligible read cache
let isRedirectingToLogin = false;
const LOGIN_REDIRECT_KEY = 'azzuniqe_login_redirect_pending';

function normalizeUrlKey(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const sortedParams = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    const search = new URLSearchParams(sortedParams).toString();
    return `${parsed.origin}${parsed.pathname}${search ? `?${search}` : ''}`;
  } catch {
    return rawUrl;
  }
}

export function invalidateApiCache(pattern = null) {
  if (!pattern) {
    readResponseCache.clear();
    return;
  }
  for (const key of readResponseCache.keys()) {
    if (key.includes(pattern)) {
      readResponseCache.delete(key);
    }
  }
}

function redirectToLogin() {
  if (
    typeof window === 'undefined' ||
    window.location.pathname === '/login' ||
    isRedirectingToLogin ||
    sessionStorage.getItem(LOGIN_REDIRECT_KEY) === 'true'
  ) {
    return;
  }
  isRedirectingToLogin = true;
  sessionStorage.setItem(LOGIN_REDIRECT_KEY, 'true');
  const redirectTarget = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
}

export async function authenticatedFetch(input, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });

  if (response.status === 401 && token && token === getStoredToken()) {
    invalidateApiCache();
    clearStoredSession();
    redirectToLogin();
  }

  return response;
}

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const rawUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const normalizedUrl = normalizeUrlKey(rawUrl);
  const storedToken = getStoredToken();

  if (!storedToken) {
    clearStoredSession();
    redirectToLogin();
    const err = new Error('Authentication required. Please log in to continue.');
    err.status = 401;
    throw err;
  }

  const requestKey = `${normalizedUrl}:${storedToken}`;

  // Check read cache if applicable
  if (method === 'GET' && options.useCache && !options.noCache) {
    const cached = readResponseCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < (options.cacheTtl || CACHE_TTL_MS)) {
      try {
        return typeof structuredClone === 'function'
          ? structuredClone(cached.data)
          : JSON.parse(JSON.stringify(cached.data));
      } catch {
        return cached.data;
      }
    }
  }

  // Deduplicate in-flight GET requests
  if (method === 'GET' && !options.noCache && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey);
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // Coordinated timeout and external signal handling
  const controller = new AbortController();
  const timeoutMs = options.timeout || 6000;
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(`API request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort(options.signal.reason);
      }, { once: true });
    }
  }

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: 'include',
    signal: controller.signal,
  };

  const fetchPromise = (async () => {
    try {
      const response = await authenticatedFetch(rawUrl, config);
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `API Request Failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      // Auto-invalidate matching read caches on successful mutations only
      if (method !== 'GET') {
        const endpointPrefix = endpoint.split('?')[0];
        invalidateApiCache(endpointPrefix);
      }

      // Store in read cache if requested
      if (method === 'GET' && options.useCache && !options.noCache) {
        readResponseCache.set(requestKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.status) throw error;

      if (error.name === 'AbortError' || didTimeout || config.signal?.aborted) {
        const abortErr = new Error(didTimeout ? `Request timed out after ${timeoutMs}ms.` : 'Request was cancelled.');
        abortErr.name = 'AbortError';
        abortErr.status = didTimeout ? 408 : 499;
        abortErr.isAborted = true;
        abortErr.didTimeout = didTimeout;
        throw abortErr;
      }

      const networkErr = new Error(error.message || 'Network connection failed. Ensure backend server is running.');
      networkErr.status = 0;
      throw networkErr;
    } finally {
      if (method === 'GET') {
        inFlightGetRequests.delete(requestKey);
      }
    }
  })();

  if (method === 'GET' && !options.noCache) {
    inFlightGetRequests.set(requestKey, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
  invalidateCache: invalidateApiCache,
};
