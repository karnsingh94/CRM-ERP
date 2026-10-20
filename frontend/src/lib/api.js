/**
 * AZZUNIQE CRM & ERP — Company Admin API Client
 * Centralized HTTP client reusing the existing backend API conventions.
 */

import { clearStoredSession, getStoredToken } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const inFlightGetRequests = new Map();

function redirectToLogin() {
  if (typeof window === 'undefined' || window.location.pathname === '/login') return;
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

  if (response.status === 401 && token === getStoredToken()) {
    clearStoredSession();
    redirectToLogin();
  }

  return response;
}

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const storedToken = getStoredToken();

  if (!storedToken) {
    clearStoredSession();
    redirectToLogin();
    const err = new Error('Authentication required. Please log in to continue.');
    err.status = 401;
    throw err;
  }

  const requestKey = `${url}:${storedToken}`;
  if (method === 'GET' && !options.noCache && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey);
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutMs = options.timeout || 6000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: 'include',
    signal: options.signal || controller.signal,
  };

  const fetchPromise = (async () => {
    try {
      const response = await authenticatedFetch(url, config);
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `API Request Failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.status) throw error;
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
};
