import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Quotation, QuotationWithItems } from '../quotations/quotations.model';
import { Invoice, InvoiceWithItems } from '../billing/billing.model';
import { Negotiation } from '../negotiations/negotiations.model';

export interface PortalProfile {
  id: string;
  company_name: string;
  customer_code: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tier: string;
}

// These two list queries have no pagination params on their routes (unlike
// every other list endpoint in the app) — changing that is an API contract
// change (array response -> paginated envelope) that needs sign-off before
// the frontend is updated to match. Until then, a hard cap keeps a customer
// with an unusually large history from returning an unbounded result set.
const PORTAL_LIST_SAFETY_CAP = 500;

// quotations/invoices store no totals (006_quotations.sql, 015_billing_invoices.sql)
// — every read here joins the *_totals view, same pattern as
// quotations.repository.ts/billing.repository.ts. This module was missed by
// the first reconciliation pass: `SELECT *` on the bare tables silently drops
// subtotal/discount_total/tax_total/grand_total from every customer-facing
// portal response instead of erroring, so it went unnoticed until traced.
export const portalRepository = {
  async listQuotationsForCustomer(customerId: string): Promise<Quotation[]> {
    const { rows } = await db.query(
      `SELECT q.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       WHERE q.customer_id = $1 ORDER BY q.created_at DESC LIMIT $2`,
      [customerId, PORTAL_LIST_SAFETY_CAP],
    );
    return rows as Quotation[];
  },

  /** Scoped by customer_id in the WHERE clause itself — a quotation belonging to another customer simply doesn't come back. */
  async findQuotationForCustomer(
    id: string,
    customerId: string,
  ): Promise<QuotationWithItems | null> {
    const { rows } = await db.query(
      `SELECT q.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       WHERE q.id = $1 AND q.customer_id = $2`,
      [id, customerId],
    );
    const quotation = rows[0] as Quotation | undefined;
    if (!quotation) return null;
    // Joins products/product_categories for a real customer-facing label —
    // quotation_item_amounts itself carries no product name, only product_id
    // (see 006_quotations.sql/027_fix_item_amounts_views_missing_created_at.sql),
    // and the portal has no other product-directory endpoint it can call.
    const items = await db.query(
      `SELECT qia.*, p.name AS product_name, pc.name AS product_category
       FROM quotation_item_amounts qia
       JOIN products p ON p.id = qia.product_id
       JOIN product_categories pc ON pc.id = p.category_id
       WHERE qia.quotation_id = $1
       ORDER BY qia.created_at ASC`,
      [id],
    );
    return { ...quotation, items: items.rows };
  },

  /**
   * Locks the customer's own quotation for the confirm flow. Scoped by
   * customer_id in the WHERE clause like every other portal read, so a
   * customer can't confirm someone else's quotation even by guessing an id.
   */
  async findQuotationForConfirmForUpdate(
    client: PoolClient,
    id: string,
    customerId: string,
  ): Promise<Quotation | null> {
    const { rows } = await client.query(
      `SELECT q.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       WHERE q.id = $1 AND q.customer_id = $2
       FOR UPDATE OF q`,
      [id, customerId],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },

  async markQuotationAccepted(client: PoolClient, id: string): Promise<Quotation | null> {
    const { rows } = await client.query(
      `WITH updated AS (
         UPDATE quotations SET status = 'ACCEPTED' WHERE id = $1 RETURNING *
       )
       SELECT updated.*, qt.subtotal, qt.discount_total, qt.tax_total, qt.grand_total
       FROM updated JOIN quotation_totals qt ON qt.quotation_id = updated.id`,
      [id],
    );
    return (rows[0] as Quotation | undefined) ?? null;
  },

  async listInvoicesForCustomer(customerId: string): Promise<Invoice[]> {
    const { rows } = await db.query(
      `SELECT i.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM invoices i
       JOIN invoice_totals it ON it.invoice_id = i.id
       WHERE i.customer_id = $1 ORDER BY i.created_at DESC LIMIT $2`,
      [customerId, PORTAL_LIST_SAFETY_CAP],
    );
    return rows as Invoice[];
  },

  async findInvoiceForCustomer(id: string, customerId: string): Promise<InvoiceWithItems | null> {
    const { rows } = await db.query(
      `SELECT i.*, it.subtotal, 0::numeric AS discount_total, it.tax_total, it.total
       FROM invoices i
       JOIN invoice_totals it ON it.invoice_id = i.id
       WHERE i.id = $1 AND i.customer_id = $2`,
      [id, customerId],
    );
    const invoice = rows[0] as Invoice | undefined;
    if (!invoice) return null;
    const items = await db.query(
      `SELECT id, invoice_id, product_id, description, quantity, unit_price, tax_percent,
              created_at, line_subtotal, tax_amount AS tax, total
       FROM invoice_item_amounts WHERE invoice_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    return { ...invoice, items: items.rows };
  },

  /** The portal's own account/profile screen — read-only, scoped to the authenticated customer. */
  async findProfileForCustomer(customerId: string): Promise<PortalProfile | null> {
    const { rows } = await db.query(
      `SELECT c.id, c.company_name, c.customer_code, c.industry, c.email, c.phone, c.website,
              ct.name AS tier
       FROM customers c
       JOIN customer_tiers ct ON ct.id = c.customer_tier_id
       WHERE c.id = $1`,
      [customerId],
    );
    return (rows[0] as PortalProfile | undefined) ?? null;
  },

  /** Every negotiation across the customer's own quotations — same join shape as negotiations.repository.ts::listAll. */
  async listNegotiationsForCustomer(
    customerId: string,
  ): Promise<(Negotiation & { quotation_number: string })[]> {
    const { rows } = await db.query(
      `SELECT n.*, q.quotation_number
       FROM negotiations n
       JOIN quotations q ON q.id = n.quotation_id
       WHERE q.customer_id = $1
       ORDER BY n.created_at DESC LIMIT $2`,
      [customerId, PORTAL_LIST_SAFETY_CAP],
    );
    return rows as (Negotiation & { quotation_number: string })[];
  },
};
