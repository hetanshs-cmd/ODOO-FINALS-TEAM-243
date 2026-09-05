/**
 * Minimal client-side JWT decoding.
 *
 * There is no `/auth/me` endpoint on the backend, so on app load we decode
 * the stored token locally to hydrate the current user's id/role and to
 * check expiry — we never verify the signature client-side (that's the
 * server's job on every authenticated request; a tampered token simply
 * fails the next API call).
 */

export interface DecodedJwt {
  sub: string;
  role?: string;
  scope?: 'internal' | 'portal';
  customerId?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const base64 = padded + padding;
  if (typeof atob === 'function') {
    // atob yields a binary string; decode as UTF-8.
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Fallback for non-browser environments (e.g. SSR/tests).
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function decodeJwt<T extends DecodedJwt = DecodedJwt>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(payload: DecodedJwt | null): boolean {
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now();
}
