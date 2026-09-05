import { db } from '../../config/database';
import { Quotation, QuotationWithItems } from '../quotations/quotations.model';
import { Invoice, InvoiceWithItems } from '../billing/billing.model';

export const portalRepository = {
  async listQuotationsForCustomer(customerId: string): Promise<Quotation[]> {
    const { rows } = await db.query(
      'SELECT * FROM quotations WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId],
    );
    return rows as Quotation[];
  },

  /** Scoped by customer_id in the WHERE clause itself — a quotation belonging to another customer simply doesn't come back. */
  async findQuotationForCustomer(id: string, customerId: string): Promise<QuotationWithItems | null> {
    const { rows } = await db.query('SELECT * FROM quotations WHERE id = $1 AND customer_id = $2', [
      id,
      customerId,
    ]);
    const quotation = rows[0] as Quotation | undefined;
    if (!quotation) return null;
    const items = await db.query(
      'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY created_at ASC',
      [id],
    );
    return { ...quotation, items: items.rows };
  },

  async listInvoicesForCustomer(customerId: string): Promise<Invoice[]> {
    const { rows } = await db.query(
      'SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId],
    );
    return rows as Invoice[];
  },

  async findInvoiceForCustomer(id: string, customerId: string): Promise<InvoiceWithItems | null> {
    const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1 AND customer_id = $2', [
      id,
      customerId,
    ]);
    const invoice = rows[0] as Invoice | undefined;
    if (!invoice) return null;
    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
    return { ...invoice, items: items.rows };
  },
};
