import axios, { InternalAxiosRequestConfig } from 'axios';
import useAppStore from '../store/useAppStore';

// Dev'da proxy ishlatamiz, production'da to'g'ridan-to'g'ri backend URL
const BASE_URL = import.meta.env.VITE_API_URL || 'https://suhbatdosh.shohruzisroilov.uz';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAppStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAppStore.getState().setToken(null);
      useAppStore.getState().setUser(null);
    }
    return Promise.reject(err);
  }
);

export default api;
