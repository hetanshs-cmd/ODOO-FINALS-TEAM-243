import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import * as authRepository from '../../src/modules/auth/auth.repository';
import { login, signup } from '../../src/modules/auth/auth.service';
import { signupSchema } from '../../src/modules/auth/auth.validator';

vi.mock('../../src/modules/auth/auth.repository');

describe('audit: authentication boundaries', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['ADMIN', 'FINANCE', 'SALES_MANAGER', 'OPERATIONS', 'CUSTOMER'])(
    'public signup rejects requested role %s before inserting a user',
    async (role) => {
      expect(
        signupSchema.safeParse({
          name: 'Audit',
          email: 'audit@example.com',
          password: 'Fixture123!',
          role,
        }).success,
      ).toBe(false);
      await expect(
        signup({ name: 'Audit', email: 'audit@example.com', password: 'Fixture123!', role }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(authRepository.createUser).not.toHaveBeenCalled();
    },
  );

  it('does not issue an internal token to a customer with a valid password', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue({
      id: 'customer-user',
      name: 'Customer',
      email: 'portal@example.com',
      status: 'ACTIVE',
      role_id: 'customer-role',
      role_name: 'CUSTOMER',
      password_hash: await bcrypt.hash('Fixture123!', 4),
    });
    await expect(login('portal@example.com', 'Fixture123!')).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(authRepository.updateLastLogin).not.toHaveBeenCalled();
  });
});
