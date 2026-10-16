/**
 * AZZUNIQE CRM & ERP — Company Admin API Client
 * Centralized HTTP client reusing the existing backend API conventions.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// In-flight deduplication cache for concurrent GET requests
const inFlightGetRequests = new Map();

/**
 * Standard fetch wrapper with centralized error handling and request deduplication
 */
export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  // Deduplicate concurrent GET requests for the same URL
  if (method === 'GET' && !options.noCache) {
    if (inFlightGetRequests.has(url)) {
      return inFlightGetRequests.get(url);
    }
  }

  const storedToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('azzuniqe_client_token') ||
        sessionStorage.getItem('azzuniqe_client_token') ||
        localStorage.getItem('azzuniqe_super_token') ||
        sessionStorage.getItem('azzuniqe_super_token')
      : null;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: 'include',
  };

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, config);
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
      if (error.status) throw error;
      const networkErr = new Error(error.message || 'Network connection failed. Ensure backend server is running.');
      networkErr.status = 0;
      throw networkErr;
    } finally {
      if (method === 'GET') {
        inFlightGetRequests.delete(url);
      }
    }
  })();

  if (method === 'GET' && !options.noCache) {
    inFlightGetRequests.set(url, fetchPromise);
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

