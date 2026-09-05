import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/config/database';
import { signPortalToken } from '../../src/utils/jwt';

/**
 * Integration test proving customer-portal tenant isolation is actually
 * enforced end-to-end (real HTTP + real DB), not just assumed from the
 * repository's WHERE clause: customer A's portal token must never be able
 * to read customer B's quotation/invoice, even by guessing a valid id.
 */
describe('GET /api/v1/portal/quotations and /api/v1/portal/invoices', () => {
  let customerAId: string;
  let customerBId: string;
  let salesRepId: string;
  let quotationAId: string;
  let invoiceAId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const tier = await db.query<{ id: string }>("SELECT id FROM customer_tiers WHERE name = 'BRONZE'");
    const repRole = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = 'SALES_REP'");

    const customerA = await db.query<{ id: string }>(
      `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
       VALUES ('Portal Resources Co A', 'INTEG-PORTAL-RES-A', $1, 'ACTIVE') RETURNING id`,
      [tier.rows[0].id],
    );
    customerAId = customerA.rows[0].id;

    const customerB = await db.query<{ id: string }>(
      `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
       VALUES ('Portal Resources Co B', 'INTEG-PORTAL-RES-B', $1, 'ACTIVE') RETURNING id`,
      [tier.rows[0].id],
    );
    customerBId = customerB.rows[0].id;

    const rep = await db.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Portal Res Rep', 'integ-portal-res-rep@example.com', 'unused-hash', 'ACTIVE', $1)
       RETURNING id`,
      [repRole.rows[0].id],
    );
    salesRepId = rep.rows[0].id;

    const quotationA = await db.query<{ id: string }>(
      `INSERT INTO quotations (quotation_number, customer_id, sales_rep_id, currency)
       VALUES ('INTEG-Q-PORTAL-RES-A', $1, $2, 'USD') RETURNING id`,
      [customerAId, salesRepId],
    );
    quotationAId = quotationA.rows[0].id;

    const invoiceA = await db.query<{ id: string }>(
      `INSERT INTO invoices (invoice_number, customer_id, invoice_type)
       VALUES ('INTEG-INV-PORTAL-RES-A', $1, 'ONE_TIME') RETURNING id`,
      [customerAId],
    );
    invoiceAId = invoiceA.rows[0].id;

    // Portal user ids aren't otherwise looked up by these routes, so a
    // synthetic user id per token is fine for this test.
    tokenA = signPortalToken('11111111-1111-1111-1111-111111111111', customerAId);
    tokenB = signPortalToken('22222222-2222-2222-2222-222222222222', customerBId);
  });

  afterAll(async () => {
    await db.query('DELETE FROM invoices WHERE id = $1', [invoiceAId]);
    await db.query('DELETE FROM quotations WHERE id = $1', [quotationAId]);
    await db.query('DELETE FROM users WHERE id = $1', [salesRepId]);
    await db.query('DELETE FROM customers WHERE id IN ($1, $2)', [customerAId, customerBId]);
  });

  it("lets customer A read their own quotation", async () => {
    const response = await request(app)
      .get(`/api/v1/portal/quotations/${quotationAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(quotationAId);
  });

  it("blocks customer B from reading customer A's quotation by id", async () => {
    const response = await request(app)
      .get(`/api/v1/portal/quotations/${quotationAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(response.status).toBe(404);
  });

  it("excludes customer A's quotation from customer B's list", async () => {
    const response = await request(app)
      .get('/api/v1/portal/quotations')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((q: { id: string }) => q.id)).not.toContain(quotationAId);
  });

  it("lets customer A read their own invoice", async () => {
    const response = await request(app)
      .get(`/api/v1/portal/invoices/${invoiceAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(invoiceAId);
  });

  it("blocks customer B from reading customer A's invoice by id", async () => {
    const response = await request(app)
      .get(`/api/v1/portal/invoices/${invoiceAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(response.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/v1/portal/quotations');
    expect(response.status).toBe(401);
  });
});
