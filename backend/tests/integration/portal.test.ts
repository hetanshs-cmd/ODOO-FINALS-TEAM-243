import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/config/database';

/**
 * Integration test for the customer portal magic-link flow — real HTTP
 * requests, real database. Uses the `devToken` the stub implementation
 * returns outside production instead of a real inbox (see auth.service.ts).
 */
describe('POST /api/v1/portal/request-link and /api/v1/portal/verify-link', () => {
  const portalEmail = 'integration-portal-user@example.com';
  const nonPortalEmail = 'integration-portal-internal@example.com';
  let customerId: string;

  beforeAll(async () => {
    const customerRole = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = 'CUSTOMER'");
    const repRole = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = 'SALES_REP'");
    const tier = await db.query<{ id: string }>("SELECT id FROM customer_tiers WHERE name = 'BRONZE'");

    const customer = await db.query<{ id: string }>(
      `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
       VALUES ('Integration Portal Co', 'INTEG-PORTAL-001', $1, 'ACTIVE')
       RETURNING id`,
      [tier.rows[0].id],
    );
    customerId = customer.rows[0].id;

    const portalUser = await db.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Portal User', $1, 'unused-hash-not-used-for-magic-link', 'ACTIVE', $2)
       RETURNING id`,
      [portalEmail, customerRole.rows[0].id],
    );
    await db.query(
      `INSERT INTO customer_users (customer_id, user_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [customerId, portalUser.rows[0].id],
    );

    // An internal user with no customer_users link — used to prove the
    // endpoint doesn't treat "user exists" as "is a portal user".
    await db.query(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Internal User', $1, 'unused-hash', 'ACTIVE', $2)`,
      [nonPortalEmail, repRole.rows[0].id],
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM customer_users WHERE customer_id = $1', [customerId]);
    await db.query('DELETE FROM users WHERE email IN ($1, $2)', [portalEmail, nonPortalEmail]);
    await db.query('DELETE FROM customers WHERE id = $1', [customerId]);
  });

  describe('POST /api/v1/portal/request-link', () => {
    it('issues a dev token for a valid, linked customer user', async () => {
      const response = await request(app).post('/api/v1/portal/request-link').send({ email: portalEmail });

      expect(response.status).toBe(200);
      expect(response.body.data.devToken).toBeTypeOf('string');
    });

    it('returns the same generic response for an unknown email (no leakage)', async () => {
      const response = await request(app)
        .post('/api/v1/portal/request-link')
        .send({ email: 'nobody-here@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data.devToken).toBeUndefined();
    });

    it('returns the same generic response for a user with no customer_users link', async () => {
      const response = await request(app).post('/api/v1/portal/request-link').send({ email: nonPortalEmail });

      expect(response.status).toBe(200);
      expect(response.body.data.devToken).toBeUndefined();
    });

    it('rejects an invalid email format', async () => {
      const response = await request(app).post('/api/v1/portal/request-link').send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/portal/verify-link', () => {
    it('completes the full request -> verify flow and returns a scoped session', async () => {
      const requestResponse = await request(app)
        .post('/api/v1/portal/request-link')
        .send({ email: portalEmail });
      const token = requestResponse.body.data.devToken;

      const verifyResponse = await request(app).post('/api/v1/portal/verify-link').send({ token });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.accessToken).toBeTypeOf('string');
      expect(verifyResponse.body.data.customerId).toBe(customerId);
      expect(verifyResponse.body.data.user.email).toBe(portalEmail);
    });

    it('rejects an invalid/unknown token', async () => {
      const response = await request(app).post('/api/v1/portal/verify-link').send({ token: 'garbage-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('INVALID_TOKEN');
    });

    it('rejects a missing token', async () => {
      const response = await request(app).post('/api/v1/portal/verify-link').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
