// Centralized API base URL handling.
// - In dev: default to '' so Vite proxy (/api -> localhost:8000) works.
// - In prod: default to the deployed backend unless overridden by VITE_API_BASE_URL.

const DEFAULT_PROD_BASE = 'https://api-spi.fastapicloud.dev';

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
  return fetch(url, {
    credentials: options.credentials ?? 'include',
    ...options,
  });
}
