/**
 * Shared TypeScript types and interfaces.
 *
 * Keep types that are shared across multiple modules here.
 * Module-specific types belong alongside the module.
 */

// ── API ───────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Common UI States ──────────────────────────────────────────────────────────

/**
 * Every data-driven component must handle these four states:
 * loading | empty | error | success
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Forms ─────────────────────────────────────────────────────────────────────

export interface FieldError {
  field: string;
  message: string;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ── Domain types will be added here after Phase 0 analysis ───────────────────
