import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Subscription, SubscriptionPlanForModify } from './subscriptions.model';

export const subscriptionsRepository = {
  async findById(id: string): Promise<Subscription | null> {
    const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return (rows[0] as Subscription | undefined) ?? null;
  },

  /** Row-locks the subscription for the duration of the enclosing transaction. */
  async findByIdForUpdate(client: PoolClient, id: string): Promise<Subscription | null> {
    const { rows } = await client.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    return (rows[0] as Subscription | undefined) ?? null;
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
    input: { planId: string; currentPrice: number },
  ): Promise<Subscription> {
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET plan_id = $2, current_price = $3, status = 'MODIFIED'
       WHERE id = $1
       RETURNING *`,
      [id, input.planId, input.currentPrice],
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

  async cancel(
    client: PoolClient,
    id: string,
    input: { endDate: string },
  ): Promise<Subscription> {
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'CANCELLED', end_date = $2, next_billing_date = NULL
       WHERE id = $1
       RETURNING *`,
      [id, input.endDate],
    );
    return rows[0] as Subscription;
  },
};
