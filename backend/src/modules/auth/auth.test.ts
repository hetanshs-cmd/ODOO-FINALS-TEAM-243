import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import * as authRepository from './auth.repository';
import * as authService from './auth.service';
import { AppError } from '../../errors/AppError';
import { UserRow } from './auth.repository';

/**
 * Unit tests for the auth service — the repository is mocked so these
 * run without a database, per docs/testing.md's "mock repositories" rule.
 * Integration tests (real DB, real HTTP) live in tests/integration/.
 */
vi.mock('./auth.repository');

// Fixture password, not a real credential — read from .env per
// docs/security.md's "no hardcoded secrets" rule. See backend/.env.example.
const rawTestPassword = process.env.TEST_USER_PASSWORD;
if (!rawTestPassword) {
  throw new Error('TEST_USER_PASSWORD must be set in backend/.env to run this test suite');
}
const PASSWORD: string = rawTestPassword;
// Low bcrypt cost so the test suite stays fast — never do this for real passwords.
const TEST_BCRYPT_ROUNDS = 4;

async function makeUser(overrides: Partial<UserRow> = {}): Promise<UserRow> {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: await bcrypt.hash(PASSWORD, TEST_BCRYPT_ROUNDS),
    status: 'ACTIVE',
    role_id: 'role-1',
    role_name: 'SALES_REP',
    ...overrides,
  };
}

describe('authService.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an access token and safe user fields for valid credentials', async () => {
    const user = await makeUser();
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);

    const result = await authService.login(user.email, PASSWORD);

    expect(result.accessToken).toBeTypeOf('string');
    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_name,
    });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(authRepository.updateLastLogin).toHaveBeenCalledWith(user.id);
  });

  it('rejects an unknown email', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);

    await expect(authService.login('ghost@example.com', PASSWORD)).rejects.toThrow(AppError);
  });

  it('rejects a wrong password', async () => {
    const user = await makeUser();
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);

    await expect(authService.login(user.email, 'wrong-password')).rejects.toThrow(AppError);
  });

  it('rejects an inactive user even with the correct password', async () => {
    const user = await makeUser({ status: 'INACTIVE' });
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);

    await expect(authService.login(user.email, PASSWORD)).rejects.toThrow(AppError);
  });

  it('gives the same error for "unknown email" and "wrong password"', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);
    let unknownEmailError: AppError | undefined;
    try {
      await authService.login('ghost@example.com', PASSWORD);
    } catch (error) {
      unknownEmailError = error as AppError;
    }

    const user = await makeUser();
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    let wrongPasswordError: AppError | undefined;
    try {
      await authService.login(user.email, 'wrong-password');
    } catch (error) {
      wrongPasswordError = error as AppError;
    }

    expect(unknownEmailError?.code).toBe(wrongPasswordError?.code);
    expect(unknownEmailError?.message).toBe(wrongPasswordError?.message);
  });
});

describe('authService.requestMagicLink / verifyMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a dev token for an active portal user', async () => {
    const user = await makeUser({ role_name: 'CUSTOMER' });
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    vi.mocked(authRepository.findActiveCustomerLink).mockResolvedValue({
      customer_id: 'customer-1',
    });

    const result = await authService.requestMagicLink(user.email);

    expect(result.devToken).toBeTypeOf('string');
  });

  it('returns the same generic message for an unknown email (no leakage)', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);

    const result = await authService.requestMagicLink('ghost@example.com');

    expect(result.devToken).toBeUndefined();
    expect(result.message).toMatch(/if this email is registered/i);
  });

  it('returns the same generic message for a user with no customer_users link', async () => {
    const user = await makeUser();
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    vi.mocked(authRepository.findActiveCustomerLink).mockResolvedValue(null);

    const result = await authService.requestMagicLink(user.email);

    expect(result.devToken).toBeUndefined();
  });

  it('completes the full request -> verify flow', async () => {
    const user = await makeUser({ role_name: 'CUSTOMER' });
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    vi.mocked(authRepository.findActiveCustomerLink).mockResolvedValue({
      customer_id: 'customer-1',
    });
    vi.mocked(authRepository.findUserById).mockResolvedValue(user);

    const { devToken } = await authService.requestMagicLink(user.email);
    const result = await authService.verifyMagicLink(devToken as string);

    expect(result.accessToken).toBeTypeOf('string');
    expect(result.customerId).toBe('customer-1');
    expect(result.user.email).toBe(user.email);
  });

  it('rejects an unknown token', async () => {
    await expect(authService.verifyMagicLink('not-a-real-token')).rejects.toThrow(AppError);
  });

  it('rejects a token that has already been used once', async () => {
    const user = await makeUser({ role_name: 'CUSTOMER' });
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    vi.mocked(authRepository.findActiveCustomerLink).mockResolvedValue({
      customer_id: 'customer-1',
    });
    vi.mocked(authRepository.findUserById).mockResolvedValue(user);

    const { devToken } = await authService.requestMagicLink(user.email);
    await authService.verifyMagicLink(devToken as string);

    await expect(authService.verifyMagicLink(devToken as string)).rejects.toThrow(AppError);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    try {
      const user = await makeUser({ role_name: 'CUSTOMER' });
      vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
      vi.mocked(authRepository.findActiveCustomerLink).mockResolvedValue({
        customer_id: 'customer-1',
      });

      const { devToken } = await authService.requestMagicLink(user.email);
      vi.advanceTimersByTime(16 * 60 * 1000); // past the 15-minute TTL

      await expect(authService.verifyMagicLink(devToken as string)).rejects.toThrow(AppError);
    } finally {
      vi.useRealTimers();
    }
  });
});
