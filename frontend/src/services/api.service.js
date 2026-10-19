/**
 * Frontend API Service Client Layer
 */

import { api, API_BASE } from '@/lib/api';

export const AuthService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout', {}),
  me: () => api.get('/auth/me'),
};

export const CompanyService = {
  getProfile: (id) => api.get(`/clients/${id}`),
  updateProfile: (id, data) => api.put(`/clients/${id}`, data),
};

export const CatalogService = {
  getServices: () => api.get('/services'),
  getServiceDetail: (id) => api.get(`/services/${id}`),
};

export { api, API_BASE };
export default api;
