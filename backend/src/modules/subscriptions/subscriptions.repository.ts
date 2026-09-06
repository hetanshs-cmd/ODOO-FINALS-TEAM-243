import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Subscription, SubscriptionPlanForModify } from './subscriptions.model';
import { CreditNote } from '../credit-notes/credit-notes.model';

export const subscriptionsRepository = {
  async findById(id: string): Promise<Subscription | null> {
    const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return (rows[0] as Subscription | undefined) ?? null;
  },

  async list(
    filters: { status?: string; customerId?: string },
    limit: number,
    offset: number,
  ): Promise<Subscription[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM subscriptions ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as Subscription[];
  },

  async count(filters: { status?: string; customerId?: string }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM subscriptions ${where}`,
      params,
    );
    return (rows[0] as { count: number }).count;
  },

  /** Row-locks the subscription for the duration of the enclosing transaction. */
  async findByIdForUpdate(client: PoolClient, id: string): Promise<Subscription | null> {
    const { rows } = await client.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    return (rows[0] as Subscription | undefined) ?? null;
  },

  /**
   * Total quantity currently on the subscription, summed from its items.
   *
   * `subscriptions` has no top-level quantity column, so a PATCH that omits
   * `quantity` used to silently fall back to 1 — collapsing a 5-seat
   * subscription's price on a plan-only change. Deriving it from the items
   * keeps an omitted `quantity` meaning "unchanged". Returns null when the
   * subscription has no items, so the caller can refuse rather than guess.
   */
  async sumItemQuantity(client: PoolClient, subscriptionId: string): Promise<number | null> {
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::float8 AS total, COUNT(*)::int AS item_count
       FROM subscription_items WHERE subscription_id = $1`,
      [subscriptionId],
    );
    const row = rows[0] as { total: number; item_count: number } | undefined;
    if (!row || row.item_count === 0) return null;
    return row.total;
  },

  async findPlanById(
    client: PoolClient,
    planId: string,
  ): Promise<SubscriptionPlanForModify | null> {
    const { rows } = await client.query(
      'SELECT id, billing_frequency, price, status FROM subscription_plans WHERE id = $1',
      [planId],
    );
    return (rows[0] as SubscriptionPlanForModify | undefined) ?? null;
  },

  /**
   * Applies a plan/quantity change. Status moves to MODIFIED — the value
   * migrations/017_subscriptions.sql's CHECK constraint reserves alongside
   * ACTIVE/CANCELLED specifically for a subscription that has diverged from
   * how it was first created, distinguishing it in reporting from one still
   * running unchanged on its original plan.
   */
  async applyModification(
    client: PoolClient,
    id: string,
    input: { planId: string; currentPrice: number; nextBillingDate: string | null },
  ): Promise<Subscription> {
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET plan_id = $2,
           current_price = $3,
           -- Recomputed by the service whenever the billing frequency
           -- changes; COALESCE keeps the existing schedule otherwise, so a
           -- plain quantity change doesn't move the billing date.
           next_billing_date = COALESCE($4, next_billing_date),
           status = 'MODIFIED'
       WHERE id = $1
       RETURNING *`,
      [id, input.planId, input.currentPrice, input.nextBillingDate],
    );
    return rows[0] as Subscription;
  },

  /**
   * Records the prorated mid-cycle charge for an upgrade as a one-off
   * billing_schedules row, billed immediately (today), separate from the
   * subscription's regular next_billing_date cadence.
   */
  async insertProrationSchedule(
    client: PoolClient,
    input: { subscriptionId: string; billingDate: string; amount: number },
  ): Promise<void> {
    await client.query(
      `INSERT INTO billing_schedules (subscription_id, billing_date, amount)
       VALUES ($1, $2, $3)`,
      [input.subscriptionId, input.billingDate, input.amount],
    );
  },

  async cancel(client: PoolClient, id: string, input: { endDate: string }): Promise<Subscription> {
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'CANCELLED', end_date = $2, next_billing_date = NULL
       WHERE id = $1
       RETURNING *`,
      [id, input.endDate],
    );
    return rows[0] as Subscription;
  },

  async insertCreditNote(
    client: PoolClient,
    input: { subscriptionId: string; customerId: string; amount: number; reason: string },
  ): Promise<CreditNote> {
    const { rows } = await client.query(
      `INSERT INTO credit_notes (subscription_id, customer_id, amount, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.subscriptionId, input.customerId, input.amount, input.reason],
    );
    return rows[0] as CreditNote;
  },
};
