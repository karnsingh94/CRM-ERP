/**
 * AZZUNIQE CRM & ERP — Company Admin API Client
 * Centralized HTTP client reusing the existing backend API conventions.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Standard fetch wrapper with centralized error handling
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const storedToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('azzuniqe_client_token') || sessionStorage.getItem('azzuniqe_client_token')
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
    // If it's already an enhanced error, throw it
    if (error.status) throw error;
    // Network or connectivity issue
    const networkErr = new Error(error.message || 'Network connection failed. Ensure backend server is running.');
    networkErr.status = 0;
    throw networkErr;
  }
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};
