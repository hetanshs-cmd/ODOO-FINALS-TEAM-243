import { db } from '../../config/database';

export interface CustomerListRow {
  id: string;
  name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  customer_tier_id: string;
  tier: string | null;
  assigned_rep_id: null;
  status: string;
  created_at: string;
  updated_at: string;
}

export const customersRepository = {
  /**
   * Flat, unpaginated array — matches the frontend's ApiCustomer[] contract
   * (services/index.ts::customerService.getAll, hooks/useCustomers.ts),
   * same as the sibling /users directory. `name` mirrors `company_name`
   * (the frontend reads `.name`); `tier` is the tier's display name, not
   * its id, resolved via a join since the frontend also reads `.tier`
   * directly. `assigned_rep_id` has no equivalent column in this schema
   * (a rep is attached per-quotation, not per-customer) — always null.
   */
  async list(): Promise<CustomerListRow[]> {
    const { rows } = await db.query(
      `SELECT c.id, c.company_name AS name, c.company_name, c.email, c.phone,
              c.customer_tier_id, ct.name AS tier, NULL AS assigned_rep_id,
              c.status, c.created_at, c.updated_at
       FROM customers c
       LEFT JOIN customer_tiers ct ON ct.id = c.customer_tier_id
       ORDER BY c.company_name ASC`,
    );
    return rows as CustomerListRow[];
  },
};
