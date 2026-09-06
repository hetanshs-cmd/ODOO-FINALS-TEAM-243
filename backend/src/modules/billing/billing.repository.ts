import { PoolClient } from 'pg';
import { db } from '../../config/database';
import {
  Invoice,
  InvoiceItem,
  Subscription,
  SubscriptionItem,
  BillingSchedule,
} from './billing.model';

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

export interface InvoiceTotals {
  subtotal: string;
  tax_total: string;
  total: string;
}

export interface SubscriptionPlanForBilling {
  id: string;
  billing_frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price: string;
}

export const billingRepository = {
  /** Serialize billing attempts for an order, including duplicate clicks. */
  async lockOrderForBilling(client: PoolClient, id: string): Promise<SalesOrderForBilling | null> {
    const { rows } = await client.query(
      'SELECT id, customer_id, quotation_id, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id],
    );
    return (rows[0] as SalesOrderForBilling | undefined) ?? null;
  },

  async hasBillingForOrder(client: PoolClient, id: string): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM invoices WHERE sales_order_id = $1)
           OR EXISTS (SELECT 1 FROM subscriptions WHERE sales_order_id = $1) AS exists`,
      [id],
    );
    return rows[0].exists as boolean;
  },

  /** The current schema has no physical/service discriminator: all ONE_TIME
   * products conservatively require shipment. Partial invoicing needs explicit
   * invoice-to-order-line tracking before it can be enabled safely. */
  async hasUnshippedOneTimeItems(client: PoolClient, id: string): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM sales_order_items soi JOIN products p ON p.id = soi.product_id
         WHERE soi.sales_order_id = $1 AND p.product_type = 'ONE_TIME'
           AND soi.fulfilled_quantity < soi.quantity
       ) AS exists`,
      [id],
    );
    return rows[0].exists as boolean;
  },

  async findSalesOrderForBilling(salesOrderId: string): Promise<SalesOrderForBilling | null> {
    const { rows } = await db.query(
      'SELECT id, customer_id, quotation_id, status FROM sales_orders WHERE id = $1',
      [salesOrderId],
    );
    return (rows[0] as SalesOrderForBilling | undefined) ?? null;
  },

  async listQuotationItemsWithProduct(quotationId: string): Promise<QuotationItemForBilling[]> {
    const { rows } = await db.query(
      `SELECT qia.id, qia.product_id, p.name AS product_name, qia.quantity, qia.unit_price,
              qia.discount_amount, qia.tax_percent, qia.line_total, qia.billing_type
       FROM quotation_item_amounts qia
       JOIN products p ON p.id = qia.product_id
       WHERE qia.quotation_id = $1`,
      [quotationId],
    );
    return rows as QuotationItemForBilling[];
  },

  async findSubscriptionPlan(planId: string): Promise<SubscriptionPlanForBilling | null> {
    const { rows } = await db.query(
      'SELECT id, billing_frequency, price FROM subscription_plans WHERE id = $1',
      [planId],
    );
    return (rows[0] as SubscriptionPlanForBilling | undefined) ?? null;
  },

  /**
   * `invoices` stores no totals (015_billing_invoices.sql) — only the raw
   * header fields are inserted; subtotal/tax_total/total/discount_total are
   * always read back from `invoice_totals` (discount_total is not tracked at
   * invoice level at all — see billing.service.ts's netAmount comment).
   */
  async insertInvoice(
    client: PoolClient,
    input: {
      invoiceNumber: string;
      customerId: string;
      salesOrderId: string;
      quotationId: string;
      dueDate: string;
    },
  ): Promise<Invoice> {
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, customer_id, sales_order_id, quotation_id, invoice_type, status, due_date)
       VALUES ($1, $2, $3, $4, 'ONE_TIME', 'DRAFT', $5)
       RETURNING *`,
      [input.invoiceNumber, input.customerId, input.salesOrderId, input.quotationId, input.dueDate],
    );
    return rows[0] as Invoice;
  },

  /**
   * Inserts the raw line inputs only — `invoice_items` has no `tax`/`total`
   * columns (015_billing_invoices.sql) — then reads the computed figures
   * back from `invoice_item_amounts` (aliasing tax_amount -> tax to match
   * the API contract's field name).
   */
  async insertInvoiceItem(
    client: PoolClient,
    input: {
      invoiceId: string;
      productId: string;
      description: string;
      quantity: string;
      unitPrice: string;
      taxPercent: string;
    },
  ): Promise<InvoiceItem> {
    const { rows } = await client.query(
      `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, tax_percent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.invoiceId,
        input.productId,
        input.description,
        input.quantity,
        input.unitPrice,
        input.taxPercent,
      ],
    );
    const insertedId = (rows[0] as { id: string }).id;
    const { rows: amountRows } = await client.query(
      `SELECT id, invoice_id, product_id, description, quantity, unit_price, tax_percent,
              created_at, line_subtotal, tax_amount AS tax, total
       FROM invoice_item_amounts WHERE id = $1`,
      [insertedId],
    );
    return amountRows[0] as InvoiceItem;
  },

  /** `invoices` stores no totals (015_billing_invoices.sql) — always read via the view. */
  async findInvoiceTotals(client: PoolClient, invoiceId: string): Promise<InvoiceTotals> {
    const { rows } = await client.query(
      'SELECT subtotal, tax_total, total FROM invoice_totals WHERE invoice_id = $1',
      [invoiceId],
    );
    return rows[0] as InvoiceTotals;
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
    },
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
      ],
    );
    return rows[0] as Subscription;
  },

  async insertSubscriptionItem(
    client: PoolClient,
    input: { subscriptionId: string; productId: string; quantity: string; unitPrice: string },
  ): Promise<SubscriptionItem> {
    const { rows } = await client.query(
      `INSERT INTO subscription_items (subscription_id, product_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.subscriptionId, input.productId, input.quantity, input.unitPrice],
    );
    return rows[0] as SubscriptionItem;
  },

  async insertBillingSchedule(
    client: PoolClient,
    input: { subscriptionId: string; billingDate: string; amount: number },
  ): Promise<BillingSchedule> {
    const { rows } = await client.query(
      `INSERT INTO billing_schedules (subscription_id, billing_date, amount)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.subscriptionId, input.billingDate, input.amount],
    );
    return rows[0] as BillingSchedule;
  },

  async updateInvoiceAfterPayment(
    client: PoolClient,
    invoiceId: string,
    status: 'PARTIALLY_PAID' | 'PAID',
    paidAt: boolean,
  ): Promise<Invoice> {
    const { rows } = await client.query(
      `WITH updated AS (
         UPDATE invoices SET status = $2, paid_at = CASE WHEN $3 THEN now() ELSE paid_at END
         WHERE id = $1 RETURNING *
       )
       SELECT updated.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM updated JOIN invoice_totals it ON it.invoice_id = updated.id`,
      [invoiceId, status, paidAt],
    );
    return rows[0] as Invoice;
  },

  /**
   * `invoices` stores no totals (015_billing_invoices.sql) — `total` in
   * particular is load-bearing: payments.service.ts uses it as the
   * overpayment ceiling, so this must never silently return undefined.
   * discount_total has no equivalent in the new schema (discount is already
   * netted into invoice_items.unit_price — see billing.service.ts) and is
   * reported as 0 rather than omitted, to keep the API contract shape.
   */
  async findInvoiceById(id: string): Promise<Invoice | null> {
    const { rows } = await db.query(
      `SELECT i.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM invoices i
       JOIN invoice_totals it ON it.invoice_id = i.id
       WHERE i.id = $1`,
      [id],
    );
    return (rows[0] as Invoice | undefined) ?? null;
  },

  async findInvoiceByIdForUpdate(client: PoolClient, id: string): Promise<Invoice | null> {
    const { rows } = await client.query(
      `SELECT i.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM invoices i
       JOIN invoice_totals it ON it.invoice_id = i.id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [id],
    );
    return (rows[0] as Invoice | undefined) ?? null;
  },

  async listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    const { rows } = await db.query(
      `SELECT id, invoice_id, product_id, description, quantity, unit_price, tax_percent,
              created_at, line_subtotal, tax_amount AS tax, total
       FROM invoice_item_amounts WHERE invoice_id = $1 ORDER BY created_at ASC`,
      [invoiceId],
    );
    return rows as InvoiceItem[];
  },

  async listInvoices(
    filters: { status?: string; customerId?: string },
    limit: number,
    offset: number,
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
      `SELECT i.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM invoices i
       JOIN invoice_totals it ON it.invoice_id = i.id
       ${where} ORDER BY i.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
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
