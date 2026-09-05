import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../../src/app';
import { db } from '../../src/config/database';

/**
 * Integration test for POST /api/v1/auth/login — real HTTP request, real
 * database. Test users are created here (not relied on from seed.js),
 * so this passes against any freshly migrated database, including CI's.
 */
describe('POST /api/v1/auth/login', () => {
  const activeEmail = 'integration-auth-active@example.com';
  const inactiveEmail = 'integration-auth-inactive@example.com';
  // Fixture password, not a real credential — read from .env per
  // docs/security.md's "no hardcoded secrets" rule. See backend/.env.example.
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) {
    throw new Error('TEST_USER_PASSWORD must be set in backend/.env to run this test suite');
  }

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    const role = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = 'SALES_REP'");
    const roleId = role.rows[0].id;

    await db.query(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Active Rep', $1, $2, 'ACTIVE', $3)`,
      [activeEmail, passwordHash, roleId],
    );
    await db.query(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Inactive Rep', $1, $2, 'INACTIVE', $3)`,
      [inactiveEmail, passwordHash, roleId],
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE email IN ($1, $2)', [activeEmail, inactiveEmail]);
  });

  it('returns an access token and safe user fields for valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: activeEmail, password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTypeOf('string');
    expect(response.body.data.user.email).toBe(activeEmail);
    expect(response.body.data.user.role).toBe('SALES_REP');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('rejects an invalid password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: activeEmail, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-here@example.com', password });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an inactive user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: inactiveEmail, password });

    expect(response.status).toBe(401);
  });

  it('rejects a missing email', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ password });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing password', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: activeEmail });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });
});
