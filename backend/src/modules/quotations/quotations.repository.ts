import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Quotation, QuotationItem } from './quotations.model';

export interface CreateQuotationInput {
  quotation_number: string;
  customer_id: string;
  sales_rep_id: string;
  price_list_id: string | null;
  currency: string;
  valid_until: string | null;
}

export interface CreateQuotationItemInput {
  quotation_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  line_total: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export const quotationsRepository = {
  async create(input: CreateQuotationInput): Promise<Quotation> {
    const { rows } = await db.query(
      `INSERT INTO quotations (quotation_number, customer_id, sales_rep_id, price_list_id, currency, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.quotation_number,
        input.customer_id,
        input.sales_rep_id,
        input.price_list_id,
        input.currency,
        input.valid_until,
      ],
    );
    return rows[0] as Quotation;
  },

  async findById(id: string): Promise<Quotation | null> {
    const { rows } = await db.query('SELECT * FROM quotations WHERE id = $1', [id]);
    return (rows[0] as Quotation | undefined) ?? null;
  },

  async listItems(quotationId: string): Promise<QuotationItem[]> {
    const { rows } = await db.query(
      'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY created_at ASC',
      [quotationId],
    );
    return rows as QuotationItem[];
  },

  async addItem(input: CreateQuotationItemInput): Promise<QuotationItem> {
    const { rows } = await db.query(
      `INSERT INTO quotation_items
         (quotation_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, tax_percent, line_total, billing_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.quotation_id,
        input.product_id,
        input.description,
        input.quantity,
        input.unit_price,
        input.discount_percent,
        input.discount_amount,
        input.tax_percent,
        input.line_total,
        input.billing_type,
      ],
    );
    return rows[0] as QuotationItem;
  },

  async list(
    filters: { status?: string; salesRepId?: string; customerId?: string },
    limit: number,
    offset: number,
  ): Promise<Quotation[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`sales_rep_id = $${params.length}`);
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM quotations ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as Quotation[];
  },

  async count(filters: {
    status?: string;
    salesRepId?: string;
    customerId?: string;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`sales_rep_id = $${params.length}`);
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM quotations ${where}`,
      params,
    );
    return (rows[0] as { count: number }).count;
  },

  /** Only DRAFT-safe fields — never customer_id/sales_rep_id/status (those change via dedicated flows). */
  async update(
    id: string,
    fields: Partial<{ price_list_id: string | null; currency: string; valid_until: string | null }>,
  ): Promise<Quotation | null> {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return this.findById(id);
    }
    const params: unknown[] = entries.map(([, value]) => value);
    const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE quotations SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...params],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },

  /** Dedicated status-transition flow (e.g. DRAFT -> SUBMITTED on submit). */
  async updateStatus(client: PoolClient, id: string, status: string): Promise<Quotation | null> {
    const { rows } = await client.query(
      'UPDATE quotations SET status = $2 WHERE id = $1 RETURNING *',
      [id, status],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },

  /**
   * Recomputes quotation-level totals from its current items. Called after
   * every item add/edit so `quotations.subtotal/discount_total/tax_total/
   * grand_total` never drift from the authoritative per-item figures.
   */
  async recalculateTotals(quotationId: string): Promise<Quotation> {
    const { rows } = await db.query(
      `UPDATE quotations SET
         subtotal = COALESCE((
           SELECT SUM(quantity * unit_price) FROM quotation_items WHERE quotation_id = $1
         ), 0),
         discount_total = COALESCE((
           SELECT SUM(discount_amount) FROM quotation_items WHERE quotation_id = $1
         ), 0),
         tax_total = COALESCE((
           SELECT SUM(line_total - (quantity * unit_price - discount_amount)) FROM quotation_items WHERE quotation_id = $1
         ), 0),
         grand_total = COALESCE((
           SELECT SUM(line_total) FROM quotation_items WHERE quotation_id = $1
         ), 0)
       WHERE id = $1
       RETURNING *`,
      [quotationId],
    );
    return rows[0] as Quotation;
  },
};
