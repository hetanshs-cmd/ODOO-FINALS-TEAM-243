import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Invoice, InvoiceItem, Subscription, SubscriptionItem, BillingSchedule } from './billing.model';

export interface SalesOrderForBilling {
  id: string;
  customer_id: string;
  quotation_id: string;
  status: string;
}

export interface QuotationItemForBilling {
  id: string;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_percent: string;
  line_total: string;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export interface SubscriptionPlanForBilling {
  id: string;
  billing_frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price: string;
}

export const billingRepository = {
  async findSalesOrderForBilling(salesOrderId: string): Promise<SalesOrderForBilling | null> {
    const { rows } = await db.query(
      'SELECT id, customer_id, quotation_id, status FROM sales_orders WHERE id = $1',
      [salesOrderId]
    );
    return (rows[0] as SalesOrderForBilling | undefined) ?? null;
  },

  async listQuotationItemsWithProduct(quotationId: string): Promise<QuotationItemForBilling[]> {
    const { rows } = await db.query(
      `SELECT qi.id, qi.product_id, p.name AS product_name, qi.quantity, qi.unit_price,
              qi.discount_amount, qi.tax_percent, qi.line_total, qi.billing_type
       FROM quotation_items qi
       JOIN products p ON p.id = qi.product_id
       WHERE qi.quotation_id = $1`,
      [quotationId]
    );
    return rows as QuotationItemForBilling[];
  },

  async findSubscriptionPlan(planId: string): Promise<SubscriptionPlanForBilling | null> {
    const { rows } = await db.query(
      'SELECT id, billing_frequency, price FROM subscription_plans WHERE id = $1',
      [planId]
    );
    return (rows[0] as SubscriptionPlanForBilling | undefined) ?? null;
  },

  async insertInvoice(
    client: PoolClient,
    input: {
      invoiceNumber: string;
      customerId: string;
      salesOrderId: string;
      quotationId: string;
      subtotal: number;
      taxTotal: number;
      total: number;
      dueDate: string;
    }
  ): Promise<Invoice> {
    const { rows } = await client.query(
      `INSERT INTO invoices
         (invoice_number, customer_id, sales_order_id, quotation_id, invoice_type, status,
          subtotal, discount_total, tax_total, total, due_date)
       VALUES ($1, $2, $3, $4, 'ONE_TIME', 'DRAFT', $5, 0, $6, $7, $8)
       RETURNING *`,
      [
        input.invoiceNumber,
        input.customerId,
        input.salesOrderId,
        input.quotationId,
        input.subtotal,
        input.taxTotal,
        input.total,
        input.dueDate,
      ]
    );
    return rows[0] as Invoice;
  },

  async insertInvoiceItem(
    client: PoolClient,
    input: {
      invoiceId: string;
      productId: string;
      description: string;
      quantity: string;
      unitPrice: string;
      tax: number;
      total: string;
    }
  ): Promise<InvoiceItem> {
    const { rows } = await client.query(
      `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.invoiceId, input.productId, input.description, input.quantity, input.unitPrice, input.tax, input.total]
    );
    return rows[0] as InvoiceItem;
  },

  async insertSubscription(
    client: PoolClient,
    input: {
      customerId: string;
      salesOrderId: string;
      quotationId: string;
      planId: string;
      startDate: string;
      nextBillingDate: string;
      currentPrice: number;
    }
  ): Promise<Subscription> {
    const { rows } = await client.query(
      `INSERT INTO subscriptions
         (customer_id, sales_order_id, quotation_id, plan_id, start_date, next_billing_date, current_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.customerId,
        input.salesOrderId,
        input.quotationId,
        input.planId,
        input.startDate,
        input.nextBillingDate,
        input.currentPrice,
      ]
    );
    return rows[0] as Subscription;
  },

  async insertSubscriptionItem(
    client: PoolClient,
    input: { subscriptionId: string; productId: string; quantity: string; unitPrice: string }
  ): Promise<SubscriptionItem> {
    const { rows } = await client.query(
      `INSERT INTO subscription_items (subscription_id, product_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.subscriptionId, input.productId, input.quantity, input.unitPrice]
    );
    return rows[0] as SubscriptionItem;
  },

  async insertBillingSchedule(
    client: PoolClient,
    input: { subscriptionId: string; billingDate: string; amount: number }
  ): Promise<BillingSchedule> {
    const { rows } = await client.query(
      `INSERT INTO billing_schedules (subscription_id, billing_date, amount)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.subscriptionId, input.billingDate, input.amount]
    );
    return rows[0] as BillingSchedule;
  },

  async updateInvoiceAfterPayment(
    client: PoolClient,
    invoiceId: string,
    status: 'PARTIALLY_PAID' | 'PAID',
    paidAt: boolean
  ): Promise<Invoice> {
    const { rows } = await client.query(
      `UPDATE invoices SET status = $2, paid_at = CASE WHEN $3 THEN now() ELSE paid_at END
       WHERE id = $1 RETURNING *`,
      [invoiceId, status, paidAt]
    );
    return rows[0] as Invoice;
  },

  async findInvoiceById(id: string): Promise<Invoice | null> {
    const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
    return (rows[0] as Invoice | undefined) ?? null;
  },

  async findInvoiceByIdForUpdate(client: PoolClient, id: string): Promise<Invoice | null> {
    const { rows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    return (rows[0] as Invoice | undefined) ?? null;
  },

  async listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    const { rows } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    return rows as InvoiceItem[];
  },

  async listInvoices(
    filters: { status?: string; customerId?: string },
    limit: number,
    offset: number
  ): Promise<Invoice[]> {
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
      `SELECT * FROM invoices ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows as Invoice[];
  },

  async countInvoices(filters: { status?: string; customerId?: string }): Promise<number> {
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
    const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM invoices ${where}`, params);
    return (rows[0] as { count: number }).count;
  },
};
