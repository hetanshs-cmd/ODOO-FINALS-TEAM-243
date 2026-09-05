import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/config/database';

/**
 * Integration test for CODEBASE_AUDIT.md's DB-1: the discount-engine
 * (checkDiscounts) and the approvals flow (act -> escalate) each raise a new
 * PENDING approval_requests row under a lock on a *different* row (the
 * quotation vs. the approval request being escalated), so two concurrent
 * writers can both conclude "no PENDING request exists yet" and insert one.
 * Migration 026 adds a partial unique index
 * (uq_approval_requests_one_pending_per_quotation) as the DB-level backstop
 * this test proves against directly: two concurrent inserts of a PENDING
 * request for the same quotation must not both succeed.
 */
describe('approval_requests: at most one PENDING request per quotation', () => {
  let quotationId: string;
  let salesRepId: string;
  let approvalLevelId: string;

  beforeAll(async () => {
    const tier = await db.query<{ id: string }>("SELECT id FROM customer_tiers WHERE name = 'BRONZE'");
    const repRole = await db.query<{ id: string }>("SELECT id FROM roles WHERE name = 'SALES_REP'");

    const customer = await db.query<{ id: string }>(
      `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
       VALUES ('Integration Uniqueness Co', 'INTEG-APPR-UNIQ-001', $1, 'ACTIVE') RETURNING id`,
      [tier.rows[0].id],
    );

    const rep = await db.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, status, role_id)
       VALUES ('Integration Uniqueness Rep', 'integ-appr-uniq-rep@example.com', 'unused-hash', 'ACTIVE', $1)
       RETURNING id`,
      [repRole.rows[0].id],
    );
    salesRepId = rep.rows[0].id;

    const quotation = await db.query<{ id: string }>(
      `INSERT INTO quotations (quotation_number, customer_id, sales_rep_id, currency)
       VALUES ('INTEG-Q-APPR-UNIQ-001', $1, $2, 'USD') RETURNING id`,
      [customer.rows[0].id, salesRepId],
    );
    quotationId = quotation.rows[0].id;

    const level = await db.query<{ id: string }>(
      `INSERT INTO approval_levels (name, level) VALUES ('Integration Uniqueness Level', 999999) RETURNING id`,
    );
    approvalLevelId = level.rows[0].id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM approval_requests WHERE quotation_id = $1', [quotationId]);
    await db.query('DELETE FROM approval_levels WHERE id = $1', [approvalLevelId]);
    await db.query('DELETE FROM quotations WHERE id = $1', [quotationId]);
    await db.query('DELETE FROM users WHERE id = $1', [salesRepId]);
    await db.query(
      `DELETE FROM customers WHERE customer_code = 'INTEG-APPR-UNIQ-001'`,
    );
  });

  it('rejects a second concurrent PENDING request for the same quotation', async () => {
    const insertPending = () =>
      db.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, approval_level_id, reason)
         VALUES ($1, $2, $3, 'concurrency test') RETURNING id`,
        [quotationId, salesRepId, approvalLevelId],
      );

    const results = await Promise.allSettled([insertPending(), insertPending()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('23505');

    const pending = await db.query(
      `SELECT COUNT(*)::int AS count FROM approval_requests WHERE quotation_id = $1 AND status = 'PENDING'`,
      [quotationId],
    );
    expect(pending.rows[0].count).toBe(1);
  });

  it('allows a new PENDING request once the previous one is no longer PENDING', async () => {
    await db.query(
      `UPDATE approval_requests SET status = 'CANCELLED' WHERE quotation_id = $1 AND status = 'PENDING'`,
      [quotationId],
    );

    const second = await db.query(
      `INSERT INTO approval_requests (quotation_id, requested_by, approval_level_id, reason)
       VALUES ($1, $2, $3, 'second round') RETURNING id`,
      [quotationId, salesRepId, approvalLevelId],
    );

    expect(second.rows[0].id).toBeTypeOf('string');
  });
});
