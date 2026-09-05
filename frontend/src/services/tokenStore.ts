/**
 * DealFlow360 — Token Store
 * Thin wrapper around localStorage for the bearer token issued by the
 * real backend (POST /auth/login, POST /portal/verify-link).
 */

const TOKEN_KEY = 'dealflow360_auth_token_v1';

export function getToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TOKEN_KEY);
    }
  } catch {
    // ignore — storage unavailable (private browsing, etc.)
  }
  return null;
}

export function setToken(token: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export const tokenStore = { getToken, setToken, clearToken };
