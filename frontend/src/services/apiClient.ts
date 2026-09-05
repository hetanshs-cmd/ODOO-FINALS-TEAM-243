/**
 * API Service — Base HTTP client
 *
 * All API calls from the frontend go through this module.
 * Components never call fetch() directly.
 *
 * Handles:
 * - Base URL configuration
 * - Authorization header injection
 * - Response envelope unwrapping
 * - Consistent error handling
 *
 * Usage:
 *   import { apiClient } from '@/services/apiClient';
 *   const data = await apiClient.get('/users');
 */

const BASE_URL = import.meta.env['VITE_API_URL'] ?? '/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // No content (204)
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const body = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiRequestError(
      response.status,
      body.error ?? 'UNKNOWN_ERROR',
      body.message ?? 'An error occurred',
      body.details,
    );
  }

  return body.data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
