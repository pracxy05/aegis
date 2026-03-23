import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aegis_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchAllEvents    = ()      => api.get('/api/events');
export const fetchByType       = (type)  => api.get(`/api/events/type/${type}`);
export const fetchBySeverity   = (sev)   => api.get(`/api/events/severity/${sev}`);
export const loginUser         = (data)  => api.post('/api/auth/login', data);
export const registerUser      = (data)  => api.post('/api/auth/register', data);
export const fetchMLEarthScore = ()      => api.get('/api/ml/earth-score');

export default api;