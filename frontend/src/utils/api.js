import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  validateToken: (accessToken) => 
    api.post('/auth/azure-token', { accessToken }),
  
  getProfile: () => 
    api.get('/auth/me'),
  
  logout: () => 
    api.post('/auth/logout'),

  updatePreferences: (preferences) => 
    api.patch('/auth/preferences', preferences),
};

// URL management API calls
export const urlAPI = {
  getUrls: (params = {}) => 
    api.get('/urls', { params }),
  
  createUrl: (data) => 
    api.post('/urls', data),
  
  getUrl: (id) => 
    api.get(`/urls/${id}`),
  
  updateUrl: (id, data) => 
    api.put(`/urls/${id}`, data),
  
  deleteUrl: (id) => 
    api.delete(`/urls/${id}`),
  
  generateQRCode: (id, customization) => 
    api.post(`/urls/${id}/qr-code`, { customization }),
};

// Analytics API calls
export const analyticsAPI = {
  getOverview: (params = {}) => 
    api.get('/analytics/overview', { params }),
  
  getUrlAnalytics: (urlId, params = {}) => 
    api.get(`/analytics/visits/${urlId}`, { params }),
  
  getCountryAnalytics: (params = {}) => 
    api.get('/analytics/countries', { params }),
  
  getDeviceAnalytics: (params = {}) => 
    api.get('/analytics/devices', { params }),
  
  getDeviceTypeBreakdown: (params = {}) => 
    api.get('/analytics/device-types', { params }),
  
  getMobileDeviceBreakdown: (params = {}) => 
    api.get('/analytics/mobile-devices', { params }),
  
  getTimePatterns: (params = {}) => 
    api.get('/analytics/time-patterns', { params }),
  
  exportData: (params = {}) => 
    api.get('/analytics/export', { params }),
};

export default api;