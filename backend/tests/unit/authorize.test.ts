import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { requireRole, requireOwnCustomer } from '../../src/middleware/authorize';
import { AppError } from '../../src/errors/AppError';

const fakeResponse = {} as Response;

describe('requireRole', () => {
  it('calls next() with no error when the user has an allowed role', () => {
    const req = { user: { id: 'user-1', role: 'ADMIN' } } as Request;
    const next = vi.fn();

    requireRole('ADMIN', 'FINANCE')(req, fakeResponse, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with 403 when the user does not have an allowed role', () => {
    const req = { user: { id: 'user-1', role: 'SALES_REP' } } as Request;
    const next = vi.fn();

    requireRole('ADMIN')(req, fakeResponse, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it('rejects with 401 when there is no authenticated user at all', () => {
    const req = {} as Request;
    const next = vi.fn();

    requireRole('ADMIN')(req, fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });
});

describe('requireOwnCustomer', () => {
  it('calls next() with no error when the route customer id matches the token', () => {
    const req = {
      portalUser: { id: 'user-1', customerId: 'customer-a' },
      params: { customerId: 'customer-a' },
    } as unknown as Request;
    const next = vi.fn();

    requireOwnCustomer('customerId')(req, fakeResponse, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with 403 when a customer user tries to access another customer', () => {
    const req = {
      portalUser: { id: 'user-1', customerId: 'customer-a' },
      params: { customerId: 'customer-b' },
    } as unknown as Request;
    const next = vi.fn();

    requireOwnCustomer('customerId')(req, fakeResponse, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it('rejects with 401 when there is no authenticated portal user at all', () => {
    const req = { params: { customerId: 'customer-a' } } as unknown as Request;
    const next = vi.fn();

    requireOwnCustomer('customerId')(req, fakeResponse, next);

    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });
});
