import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { SalesOrder, SalesOrderItem, SalesOrderStatus } from './sales-orders.model';

export interface QuotationForConversion {
  id: string;
  status: string;
  customer_id: string;
  sales_rep_id: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
}

export interface QuotationItemForConversion {
  id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  line_total: string;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export interface CreateSalesOrderInput {
  order_number: string;
  quotation_id: string;
  customer_id: string;
  sales_rep_id: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
}

export interface CreateSalesOrderItemInput {
  sales_order_id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  total: string;
}

export const salesOrdersRepository = {
  async findQuotationForConversion(quotationId: string): Promise<QuotationForConversion | null> {
    const { rows } = await db.query(
      `SELECT id, status, customer_id, sales_rep_id, subtotal, discount_total, tax_total, grand_total
       FROM quotations WHERE id = $1`,
      [quotationId]
    );
    return (rows[0] as QuotationForConversion | undefined) ?? null;
  },

  async listQuotationItemsForConversion(quotationId: string): Promise<QuotationItemForConversion[]> {
    const { rows } = await db.query(
      `SELECT id, product_id, quantity, unit_price, discount_amount, line_total, billing_type
       FROM quotation_items WHERE quotation_id = $1`,
      [quotationId]
    );
    return rows as QuotationItemForConversion[];
  },

  async insert(client: PoolClient, input: CreateSalesOrderInput): Promise<SalesOrder> {
    const { rows } = await client.query(
      `INSERT INTO sales_orders
         (order_number, quotation_id, customer_id, sales_rep_id, subtotal, discount_total, tax_total, grand_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.order_number,
        input.quotation_id,
        input.customer_id,
        input.sales_rep_id,
        input.subtotal,
        input.discount_total,
        input.tax_total,
        input.grand_total,
      ]
    );
    return rows[0] as SalesOrder;
  },

  async insertItem(client: PoolClient, input: CreateSalesOrderItemInput): Promise<SalesOrderItem> {
    const { rows } = await client.query(
      `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, discount, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.sales_order_id, input.product_id, input.quantity, input.unit_price, input.discount, input.total]
    );
    return rows[0] as SalesOrderItem;
  },

  async markQuotationConverted(client: PoolClient, quotationId: string): Promise<void> {
    await client.query(`UPDATE quotations SET status = 'CONVERTED' WHERE id = $1`, [quotationId]);
  },

  async updateStatus(client: PoolClient, salesOrderId: string, status: SalesOrderStatus): Promise<void> {
    await client.query('UPDATE sales_orders SET status = $2 WHERE id = $1', [salesOrderId, status]);
  },

  async findById(id: string): Promise<SalesOrder | null> {
    const { rows } = await db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
    return (rows[0] as SalesOrder | undefined) ?? null;
  },

  async listItems(salesOrderId: string): Promise<SalesOrderItem[]> {
    const { rows } = await db.query(
      'SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY created_at ASC',
      [salesOrderId]
    );
    return rows as SalesOrderItem[];
  },

  async list(
    filters: { status?: string; customerId?: string },
    limit: number,
    offset: number
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
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT * FROM sales_orders ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows as SalesOrder[];
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
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM sales_orders ${where}`, params);
    return (rows[0] as { count: number }).count;
  },
};
