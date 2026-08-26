import axios, { InternalAxiosRequestConfig } from 'axios';
import useAppStore from '../store/useAppStore';

/**
 * Dev'da Vite proxy ('/api' -> localhost:3001), production'da VITE_API_URL.
 *
 * Ilgari fallback to'g'ridan-to'g'ri production domenga ketardi — ya'ni VITE_API_URL
 * o'rnatilmagan dev build jimgina real foydalanuvchilar ma'lumotiga yozardi.
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured;

  if (import.meta.env.PROD) {
    // vite.config.ts fails the build when this is missing, so reaching here means
    // something bypassed it. Complain loudly, but fall back to same-origin rather
    // than throwing at module scope — a throw here renders a blank page before the
    // ErrorBoundary can mount.
    console.error(
      '[api] VITE_API_URL is not set in this production build. Falling back to same-origin /api.'
    );
  }

  return '/api';
}

export const BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
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
