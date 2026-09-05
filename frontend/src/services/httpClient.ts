/**
 * DealFlow360 — HTTP Client
 * Thin fetch() wrapper for the real backend, mounted under /api/v1.
 * Unwraps the standard success envelope { success, data, message } and
 * throws a typed ApiError on { success: false, error, message } or on
 * a network/transport failure.
 *
 * No new dependency is introduced here on purpose — fetch is native.
 */

import { getToken } from './tokenStore';

const DEFAULT_BASE_URL = '/api/v1';

function resolveBaseUrl(): string {
  try {
    const fromEnv = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (typeof fromEnv === 'string' && fromEnv.trim()) {
      return fromEnv.trim().replace(/\/+$/, '');
    }
  } catch {
    // import.meta may not be available in every runtime (e.g. some test setups)
  }
  return DEFAULT_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ApiEnvelopeSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiEnvelopeError {
  success: false;
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Typed error thrown by every httpClient call. Deliberately extends Error
 * (and always carries a non-empty `.message`) so existing call sites that
 * do `catch (err: any) { ... err.message ... }` keep working unchanged.
 */
export class ApiError extends Error {
  /** Machine-readable error code from the backend, e.g. "FORBIDDEN", "VALIDATION_ERROR". */
  public readonly error: string;
  /** HTTP status code, or 0 for a network-level failure (no response at all). */
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, error: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.error = error;
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${API_BASE_URL}${normalizedPath}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export async function request<T = unknown>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, query, signal } = options;
  const url = buildUrl(path, query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkError) {
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      'NETWORK_ERROR',
      0,
      networkError
    );
  }

  // 204 No Content — nothing to unwrap.
  if (response.status === 204) {
    return undefined as T;
  }

  let payload: ApiEnvelopeSuccess<T> | ApiEnvelopeError | undefined;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || payload.success === false) {
    const errPayload = payload as ApiEnvelopeError | undefined;
    throw new ApiError(
      errPayload?.message || `Request failed with status ${response.status}`,
      errPayload?.error || 'UNKNOWN_ERROR',
      response.status,
      errPayload?.details
    );
  }

  return (payload as ApiEnvelopeSuccess<T>).data;
}

export const httpClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

export default httpClient;
