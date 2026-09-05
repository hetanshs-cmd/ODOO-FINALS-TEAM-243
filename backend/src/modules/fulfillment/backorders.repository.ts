import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Backorder } from './backorders.model';

export const backordersRepository = {
  async list(
    filters: { status?: string },
    limit: number,
    offset: number,
  ): Promise<Backorder[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM backorders ${where}
       ORDER BY created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as Backorder[];
  },

  async count(filters: { status?: string }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM backorders ${where}`, params);
    return (rows[0] as { count: number }).count;
  },

  /** Row-locks the backorder for the duration of the consolidate transaction. */
  async findByIdForUpdate(client: PoolClient, id: string): Promise<Backorder | null> {
    const { rows } = await client.query('SELECT * FROM backorders WHERE id = $1 FOR UPDATE', [id]);
    return (rows[0] as Backorder | undefined) ?? null;
  },

  async markFulfilled(client: PoolClient, id: string): Promise<Backorder> {
    const { rows } = await client.query(
      `UPDATE backorders SET status = 'FULFILLED', fulfilled_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    return rows[0] as Backorder;
  },

  async reduceBackorderedQuantity(
    client: PoolClient,
    salesOrderItemId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE sales_order_items SET backordered_quantity = backordered_quantity - $2 WHERE id = $1`,
      [salesOrderItemId, quantity],
    );
  },
};
