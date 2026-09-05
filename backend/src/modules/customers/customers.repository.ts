import { db } from '../../config/database';

export interface CustomerListRow {
  id: string;
  company_name: string;
  customer_tier_id: string;
  status: string;
}

export const customersRepository = {
  async list(limit: number, offset: number): Promise<CustomerListRow[]> {
    const { rows } = await db.query(
      `SELECT id, company_name, customer_tier_id, status
       FROM customers
       ORDER BY company_name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows as CustomerListRow[];
  },

  async count(): Promise<number> {
    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM customers');
    return (rows[0] as { count: number }).count;
  },
};
