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
  tax_percent: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export const quotationsRepository = {
  /** Takes the caller's transaction client so the insert and its audit row commit together. */
  async create(client: PoolClient, input: CreateQuotationInput): Promise<Quotation> {
    const { rows } = await client.query(
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
    // A brand-new quotation has no items yet, so quotation_totals would
    // report all-zero anyway — skip the extra round trip.
    return {
      ...(rows[0] as Omit<Quotation, 'subtotal' | 'discount_total' | 'tax_total' | 'grand_total'>),
      subtotal: '0.00',
      discount_total: '0.00',
      tax_total: '0.00',
      grand_total: '0.00',
    };
  },

  /**
   * Money totals are not stored on `quotations` — they're derived from
   * quotation_items via the `quotation_totals` view (single source of
   * truth, see 006_quotations.sql), so every read joins it in.
   */
  async findById(id: string): Promise<Quotation | null> {
    const { rows } = await db.query(
      `SELECT q.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       WHERE q.id = $1`,
      [id],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },

  /**
   * margin_percent is computed here (not stored) from the product's current
   * cost_price, mirroring upsell.repository's margin CASE — null when the
   * product has no cost_price on record, never a guessed value.
   *
   * Reads from `quotation_item_amounts` (not the bare `quotation_items`
   * table) so discount_amount/tax_amount/line_total come from the single
   * canonical formula instead of being recomputed here.
   */
  async listItems(quotationId: string): Promise<QuotationItem[]> {
    const { rows } = await db.query(
      `SELECT qia.*,
              CASE WHEN p.cost_price IS NULL OR qia.unit_price = 0 THEN NULL
                   ELSE ROUND(((qia.unit_price - p.cost_price) / qia.unit_price * 100)::numeric, 2)
              END AS margin_percent
       FROM quotation_item_amounts qia
       JOIN products p ON p.id = qia.product_id
       WHERE qia.quotation_id = $1
       ORDER BY qia.created_at ASC`,
      [quotationId],
    );
    return rows as QuotationItem[];
  },

  async findProductCostPrice(productId: string): Promise<string | null> {
    const { rows } = await db.query('SELECT cost_price FROM products WHERE id = $1', [productId]);
    return (rows[0] as { cost_price: string | null } | undefined)?.cost_price ?? null;
  },

  /**
   * Inserts the raw line inputs only — discount_amount/tax_amount/line_total
   * are never stored (006_quotations.sql), so the insert is immediately
   * followed by a read from `quotation_item_amounts` to hand back the
   * computed figures the caller (and the API contract) still needs.
   */
  async addItem(input: CreateQuotationItemInput): Promise<QuotationItem> {
    const { rows } = await db.query(
      `INSERT INTO quotation_items
         (quotation_id, product_id, description, quantity, unit_price, discount_percent, tax_percent, billing_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.quotation_id,
        input.product_id,
        input.description,
        input.quantity,
        input.unit_price,
        input.discount_percent,
        input.tax_percent,
        input.billing_type,
      ],
    );
    const insertedId = (rows[0] as { id: string }).id;
    const { rows: amountRows } = await db.query(
      'SELECT * FROM quotation_item_amounts WHERE id = $1',
      [insertedId],
    );
    return amountRows[0] as QuotationItem;
  },

  /** Ownership check before update/remove — confirms the item belongs to this quotation. */
  async findItem(quotationId: string, itemId: string): Promise<{ id: string } | null> {
    const { rows } = await db.query(
      'SELECT id FROM quotation_items WHERE id = $1 AND quotation_id = $2',
      [itemId, quotationId],
    );
    return (rows[0] as { id: string } | undefined) ?? null;
  },

  /** Same raw-inputs-only + read-back-from-the-view pattern as addItem. */
  async updateItem(
    itemId: string,
    fields: Partial<{
      quantity: number;
      unit_price: number;
      discount_percent: number;
      tax_percent: number;
      description: string | null;
      billing_type: 'ONE_TIME' | 'RECURRING';
    }>,
  ): Promise<QuotationItem | null> {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      const { rows } = await db.query('SELECT * FROM quotation_item_amounts WHERE id = $1', [itemId]);
      return (rows[0] as QuotationItem | undefined) ?? null;
    }
    const params: unknown[] = entries.map(([, value]) => value);
    const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    await db.query(`UPDATE quotation_items SET ${setClause} WHERE id = $1`, [itemId, ...params]);
    const { rows } = await db.query('SELECT * FROM quotation_item_amounts WHERE id = $1', [itemId]);
    return (rows[0] as QuotationItem | undefined) ?? null;
  },

  async removeItem(itemId: string): Promise<void> {
    await db.query('DELETE FROM quotation_items WHERE id = $1', [itemId]);
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
      `SELECT q.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       ${where}
       ORDER BY q.created_at DESC, q.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
    fields: Partial<{
      price_list_id: string | null;
      currency: string;
      valid_until: string | null;
      order_discount_percent: number;
    }>,
  ): Promise<Quotation | null> {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return this.findById(id);
    }
    const params: unknown[] = entries.map(([, value]) => value);
    const setClause = entries.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    // quotation_totals now depends on order_discount_percent (see 028_...sql),
    // so this can't be one UPDATE...RETURNING joined to the view in a single
    // statement: a view's own scan of `quotations` uses the same snapshot as
    // the rest of that statement, taken before this UPDATE, and would read
    // the pre-update order_discount_percent. Two round trips forces the
    // totals read to see the committed write.
    const result = await db.query(`UPDATE quotations SET ${setClause} WHERE id = $1`, [id, ...params]);
    if (result.rowCount === 0) return null;
    return this.findById(id);
  },

  async listTimeline(quotationId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await db.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'quotation' AND entity_id = $1
       ORDER BY created_at ASC`,
      [quotationId],
    );
    return rows;
  },

  /** Dedicated status-transition flow (e.g. DRAFT -> SUBMITTED on submit). */
  async updateStatus(client: PoolClient, id: string, status: string): Promise<Quotation | null> {
    const { rows } = await client.query(
      `WITH updated AS (
         UPDATE quotations SET status = $2 WHERE id = $1 RETURNING *
       )
       SELECT updated.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM updated JOIN quotation_totals qt ON qt.quotation_id = updated.id`,
      [id, status],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },
};
