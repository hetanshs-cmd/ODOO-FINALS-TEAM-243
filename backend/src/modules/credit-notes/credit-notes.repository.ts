import { db } from '../../config/database';
import { CreditNote, CreditNoteStatus } from './credit-notes.model';

export const creditNotesRepository = {
  async list(
    filters: { status?: string; customerId?: string; subscriptionId?: string },
    limit: number,
    offset: number,
  ): Promise<CreditNote[]> {
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
    if (filters.subscriptionId) {
      params.push(filters.subscriptionId);
      conditions.push(`subscription_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM credit_notes ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as CreditNote[];
  },

  async count(filters: {
    status?: string;
    customerId?: string;
    subscriptionId?: string;
  }): Promise<number> {
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
    if (filters.subscriptionId) {
      params.push(filters.subscriptionId);
      conditions.push(`subscription_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM credit_notes ${where}`,
      params,
    );
    return (rows[0] as { count: number }).count;
  },

  async findById(id: string): Promise<CreditNote | null> {
    const { rows } = await db.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
    return (rows[0] as CreditNote | undefined) ?? null;
  },

  async updateStatus(id: string, status: CreditNoteStatus): Promise<CreditNote | null> {
    const { rows } = await db.query(
      'UPDATE credit_notes SET status = $2 WHERE id = $1 RETURNING *',
      [id, status],
    );
    return (rows[0] as CreditNote | undefined) ?? null;
  },
};
