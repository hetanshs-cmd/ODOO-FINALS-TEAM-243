import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { SalesOrder, SalesOrderItem, SalesOrderStatus } from './sales-orders.model';

export interface QuotationForConversion {
  id: string;
  status: string;
  customer_id: string;
  sales_rep_id: string;
}

export interface QuotationItemForConversion {
  id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_percent: string;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export interface CreateSalesOrderInput {
  order_number: string;
  quotation_id: string;
  customer_id: string;
  sales_rep_id: string;
}

export interface CreateSalesOrderItemInput {
  sales_order_id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_percent: string;
}

export interface SalesOrderTotals {
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
}

export const salesOrdersRepository = {
  async findQuotationForConversion(quotationId: string): Promise<QuotationForConversion | null> {
    const { rows } = await db.query(
      `SELECT id, status, customer_id, sales_rep_id FROM quotations WHERE id = $1`,
      [quotationId],
    );
    return (rows[0] as QuotationForConversion | undefined) ?? null;
  },

  /**
   * Same read, but inside the caller's transaction and holding a row lock, so
   * the status check and the insert can't be split by a concurrent convert.
   * `sales_orders.quotation_id` is UNIQUE, so the DB is the final backstop —
   * this just turns a raw constraint violation into a clean 422.
   */
  async findQuotationForConversionForUpdate(
    client: PoolClient,
    quotationId: string,
  ): Promise<QuotationForConversion | null> {
    const { rows } = await client.query(
      `SELECT id, status, customer_id, sales_rep_id FROM quotations WHERE id = $1 FOR UPDATE`,
      [quotationId],
    );
    return (rows[0] as QuotationForConversion | undefined) ?? null;
  },

  /**
   * discount_amount/tax_percent come from `quotation_item_amounts` (not the
   * bare `quotation_items` table): discount_amount is frozen onto the sales
   * order line as its absolute `discount` (011_sales_orders.sql), and
   * tax_percent carries over unchanged — the order's own totals are then
   * derived independently via `sales_order_totals`, not copied.
   */
  async listQuotationItemsForConversion(
    quotationId: string,
  ): Promise<QuotationItemForConversion[]> {
    const { rows } = await db.query(
      `SELECT id, product_id, quantity, unit_price, discount_amount, tax_percent, billing_type
       FROM quotation_item_amounts WHERE quotation_id = $1`,
      [quotationId],
    );
    return rows as QuotationItemForConversion[];
  },

  async insert(
    client: PoolClient,
    input: CreateSalesOrderInput,
  ): Promise<Omit<SalesOrder, 'subtotal' | 'discount_total' | 'tax_total' | 'grand_total'>> {
    const { rows } = await client.query(
      `INSERT INTO sales_orders (order_number, quotation_id, customer_id, sales_rep_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.order_number, input.quotation_id, input.customer_id, input.sales_rep_id],
    );
    return rows[0] as Omit<SalesOrder, 'subtotal' | 'discount_total' | 'tax_total' | 'grand_total'>;
  },

  /**
   * Inserts the raw line inputs only — `total` is never stored
   * (011_sales_orders.sql) — then reads the computed figure back from
   * `sales_order_item_amounts`, same pattern as quotations.repository.addItem.
   */
  async insertItem(client: PoolClient, input: CreateSalesOrderItemInput): Promise<SalesOrderItem> {
    const { rows } = await client.query(
      `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, discount, tax_percent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.sales_order_id,
        input.product_id,
        input.quantity,
        input.unit_price,
        input.discount,
        input.tax_percent,
      ],
    );
    const insertedId = (rows[0] as { id: string }).id;
    const { rows: amountRows } = await client.query(
      'SELECT * FROM sales_order_item_amounts WHERE id = $1',
      [insertedId],
    );
    return amountRows[0] as SalesOrderItem;
  },

  /** `sales_orders` stores no totals (011_sales_orders.sql) — always read via the view. */
  async findTotals(client: PoolClient, salesOrderId: string): Promise<SalesOrderTotals> {
    const { rows } = await client.query(
      'SELECT subtotal, discount_total, tax_total, grand_total FROM sales_order_totals WHERE sales_order_id = $1',
      [salesOrderId],
    );
    return rows[0] as SalesOrderTotals;
  },

  async markQuotationConverted(client: PoolClient, quotationId: string): Promise<void> {
    await client.query(`UPDATE quotations SET status = 'CONVERTED' WHERE id = $1`, [quotationId]);
  },

  async updateStatus(
    client: PoolClient,
    salesOrderId: string,
    status: SalesOrderStatus,
  ): Promise<void> {
    await client.query('UPDATE sales_orders SET status = $2 WHERE id = $1', [salesOrderId, status]);
  },

  async findById(id: string): Promise<SalesOrder | null> {
    const { rows } = await db.query(
      `SELECT so.*, sot.subtotal, sot.discount_total, sot.tax_total, sot.grand_total
       FROM sales_orders so
       JOIN sales_order_totals sot ON sot.sales_order_id = so.id
       WHERE so.id = $1`,
      [id],
    );
    return (rows[0] as SalesOrder | undefined) ?? null;
  },

  async listItems(salesOrderId: string): Promise<SalesOrderItem[]> {
    const { rows } = await db.query(
      'SELECT * FROM sales_order_item_amounts WHERE sales_order_id = $1 ORDER BY created_at ASC',
      [salesOrderId],
    );
    return rows as SalesOrderItem[];
  },

  async list(
    filters: { status?: string; customerId?: string; quotationId?: string; salesRepId?: string },
    limit: number,
    offset: number,
  ): Promise<SalesOrder[]> {
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
    if (filters.quotationId) {
      params.push(filters.quotationId);
      conditions.push(`quotation_id = $${params.length}`);
    }
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`sales_rep_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT so.*, sot.subtotal, sot.discount_total, sot.tax_total, sot.grand_total
       FROM sales_orders so
       JOIN sales_order_totals sot ON sot.sales_order_id = so.id
       ${where} ORDER BY so.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as SalesOrder[];
  },

  async count(filters: {
    status?: string;
    customerId?: string;
    quotationId?: string;
    salesRepId?: string;
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
    if (filters.quotationId) {
      params.push(filters.quotationId);
      conditions.push(`quotation_id = $${params.length}`);
    }
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`sales_rep_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM sales_orders ${where}`,
      params,
    );
    return (rows[0] as { count: number }).count;
  },
};
