// Centralized API base URL handling.
// - In dev: default to '' so Vite proxy (/api -> localhost:8000) works.
// - In prod: default to the deployed backend unless overridden by VITE_API_BASE_URL.

const DEFAULT_PROD_BASE = 'https://api-spi.fastapicloud.dev';
const ADMIN_TOKEN_KEY = 'adkrux_admin_token';

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

export const API_BASE_URL = stripTrailingSlashes(
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : DEFAULT_PROD_BASE)
);

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(path, options = {}) {
  const url = apiUrl(path);

  const headers = new Headers(options.headers || {});
  try {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : null;
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  } catch {}

  return fetch(url, {
    credentials: options.credentials ?? 'include',
    ...options,
    headers,
  });
}

export function clearAdminToken() {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

export function setAdminToken(token) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(ADMIN_TOKEN_KEY, String(token || ''));
  } catch {}
}
