/**
 * Application Constants
 *
 * Single source of truth for:
 * - API endpoint paths
 * - Local storage keys
 * - App-wide constants
 *
 * Import from here instead of hardcoding strings in components.
 */

// ── API ───────────────────────────────────────────────────────────────────────
export const API_BASE = '/api/v1';

export const API_ROUTES = {
  HEALTH: `${API_BASE}/health`,
  // Module routes will be added here after Phase 0
} as const;

// ── Local Storage Keys ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ── Validation ────────────────────────────────────────────────────────────────
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
} as const;
