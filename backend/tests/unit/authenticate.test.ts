import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { authenticate, authenticatePortal } from '../../src/middleware/authenticate';
import { signInternalToken, signPortalToken } from '../../src/utils/jwt';
import { AppError } from '../../src/errors/AppError';

function fakeRequest(authorizationHeader?: string): Request {
  return { headers: { authorization: authorizationHeader } } as unknown as Request;
}

const fakeResponse = {} as Response;

describe('authenticate middleware', () => {
  it('rejects a request with no Authorization header', () => {
    const next = vi.fn();
    authenticate(fakeRequest(), fakeResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it('rejects a malformed Authorization header (no "Bearer " prefix)', () => {
    const next = vi.fn();
    authenticate(fakeRequest('some-raw-token'), fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('rejects an invalid/garbage token', () => {
    const next = vi.fn();
    authenticate(fakeRequest('Bearer not-a-real-jwt'), fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('attaches req.user and calls next() with no error for a valid internal token', () => {
    const token = signInternalToken('user-1', 'SALES_REP');
    const req = fakeRequest(`Bearer ${token}`);
    const next = vi.fn();

    authenticate(req, fakeResponse, next);

    expect(req.user).toEqual({ id: 'user-1', role: 'SALES_REP' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a portal-scoped token (wrong scope for this middleware)', () => {
    const token = signPortalToken('user-1', 'customer-1');
    const next = vi.fn();

    authenticate(fakeRequest(`Bearer ${token}`), fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });
});

describe('authenticatePortal middleware', () => {
  it('rejects a request with no Authorization header', () => {
    const next = vi.fn();
    authenticatePortal(fakeRequest(), fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('attaches req.portalUser for a valid portal token', () => {
    const token = signPortalToken('user-1', 'customer-1');
    const req = fakeRequest(`Bearer ${token}`);
    const next = vi.fn();

    authenticatePortal(req, fakeResponse, next);

    expect(req.portalUser).toEqual({ id: 'user-1', customerId: 'customer-1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an internal-scoped token (wrong scope for this middleware)', () => {
    const token = signInternalToken('user-1', 'ADMIN');
    const next = vi.fn();

    authenticatePortal(fakeRequest(`Bearer ${token}`), fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });
});
