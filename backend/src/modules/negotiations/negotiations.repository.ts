import { PoolClient } from 'pg';
import { db } from '../../config/database';
import {
  Negotiation,
  NegotiationChange,
  NegotiationMessage,
  NegotiationMessageType,
} from './negotiations.model';

export interface QuotationForNegotiation {
  id: string;
  status: string;
  sales_rep_id: string;
  customer_id: string;
}

export interface QuotationItemForChange {
  id: string;
  quotation_id: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
}

export const negotiationsRepository = {
  /**
   * Inbox listing across all quotations — the sales-rep-facing counterpart
   * to listByQuotationId (which only helps once you already know which
   * quotation to look at). A rep sees only threads on their own quotations;
   * managers/admins see everything, matching the access rule used
   * elsewhere in this codebase (e.g. quotations.service.ts).
   */
  async listAll(
    filters: { salesRepId?: string },
    limit: number,
    offset: number,
  ): Promise<(Negotiation & { quotation_number: string; customer_id: string })[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`q.sales_rep_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT n.*, q.quotation_number, q.customer_id
       FROM negotiations n
       JOIN quotations q ON q.id = n.quotation_id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as (Negotiation & { quotation_number: string; customer_id: string })[];
  },

  async countAll(filters: { salesRepId?: string }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.salesRepId) {
      params.push(filters.salesRepId);
      conditions.push(`q.sales_rep_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM negotiations n JOIN quotations q ON q.id = n.quotation_id ${where}`,
      params,
    );
    return (rows[0] as { count: number }).count;
  },

  async findQuotationForNegotiation(quotationId: string): Promise<QuotationForNegotiation | null> {
    const { rows } = await db.query(
      'SELECT id, status, sales_rep_id, customer_id FROM quotations WHERE id = $1',
      [quotationId],
    );
    return (rows[0] as QuotationForNegotiation | undefined) ?? null;
  },

  async insertNegotiation(input: {
    quotationId: string;
    initiatedBy: string;
  }): Promise<Negotiation> {
    const { rows } = await db.query(
      `INSERT INTO negotiations (quotation_id, initiated_by) VALUES ($1, $2) RETURNING *`,
      [input.quotationId, input.initiatedBy],
    );
    return rows[0] as Negotiation;
  },

  async findById(id: string): Promise<Negotiation | null> {
    const { rows } = await db.query('SELECT * FROM negotiations WHERE id = $1', [id]);
    return (rows[0] as Negotiation | undefined) ?? null;
  },

  /**
   * Both the customer portal and the internal sales-rep view need to find
   * an *existing* negotiation thread for a quotation without already
   * knowing its id (only `open`/`findById` existed before) — otherwise the
   * only entry point is always-create, which would spawn a new thread on
   * every page load instead of resuming the existing conversation. Most
   * recent first: a quotation could in principle have more than one
   * negotiation row over its lifetime (e.g. a prior one closed).
   */
  async listByQuotationId(quotationId: string): Promise<Negotiation[]> {
    const { rows } = await db.query(
      'SELECT * FROM negotiations WHERE quotation_id = $1 ORDER BY created_at DESC',
      [quotationId],
    );
    return rows as Negotiation[];
  },

  async findByIdWithCustomer(id: string): Promise<(Negotiation & { customer_id: string }) | null> {
    const { rows } = await db.query(
      `SELECT n.*, q.customer_id
       FROM negotiations n
       JOIN quotations q ON q.id = n.quotation_id
       WHERE n.id = $1`,
      [id],
    );
    return (rows[0] as (Negotiation & { customer_id: string }) | undefined) ?? null;
  },

  async updateStatus(client: PoolClient, id: string, status: string): Promise<void> {
    await client.query('UPDATE negotiations SET status = $2 WHERE id = $1', [id, status]);
  },

  async insertMessage(
    client: PoolClient,
    input: {
      negotiationId: string;
      senderUserId: string;
      message: string;
      messageType: NegotiationMessageType;
    },
  ): Promise<NegotiationMessage> {
    const { rows } = await client.query(
      `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.negotiationId, input.senderUserId, input.message, input.messageType],
    );
    return rows[0] as NegotiationMessage;
  },

  async listMessages(negotiationId: string): Promise<NegotiationMessage[]> {
    const { rows } = await db.query(
      'SELECT * FROM negotiation_messages WHERE negotiation_id = $1 ORDER BY created_at ASC',
      [negotiationId],
    );
    return rows as NegotiationMessage[];
  },

  async listChanges(negotiationId: string): Promise<NegotiationChange[]> {
    const { rows } = await db.query(
      'SELECT * FROM negotiation_changes WHERE negotiation_id = $1 ORDER BY created_at ASC',
      [negotiationId],
    );
    return rows as NegotiationChange[];
  },

  async findQuotationItemForChange(itemId: string): Promise<QuotationItemForChange | null> {
    const { rows } = await db.query(
      'SELECT id, quotation_id, quantity, unit_price, discount_percent, tax_percent FROM quotation_items WHERE id = $1',
      [itemId],
    );
    return (rows[0] as QuotationItemForChange | undefined) ?? null;
  },

  async updateQuotationItemDiscount(
    client: PoolClient,
    itemId: string,
    input: { discountPercent: number; discountAmount: number; lineTotal: number },
  ): Promise<void> {
    await client.query(
      `UPDATE quotation_items SET discount_percent = $2, discount_amount = $3, line_total = $4 WHERE id = $1`,
      [itemId, input.discountPercent, input.discountAmount, input.lineTotal],
    );
  },

  async insertChange(
    client: PoolClient,
    input: {
      negotiationId: string;
      quotationItemId: string;
      fieldName: string;
      oldValue: string;
      newValue: string;
      changedBy: string;
    },
  ): Promise<NegotiationChange> {
    const { rows } = await client.query(
      `INSERT INTO negotiation_changes (negotiation_id, quotation_item_id, field_name, old_value, new_value, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        input.negotiationId,
        input.quotationItemId,
        input.fieldName,
        input.oldValue,
        input.newValue,
        input.changedBy,
      ],
    );
    return rows[0] as NegotiationChange;
  },

  /** Client-scoped mirror of quotationsRepository.recalculateTotals — must run
   * inside the same transaction as the item updates above to see them. */
  async recalculateQuotationTotals(client: PoolClient, quotationId: string): Promise<void> {
    await client.query(
      `UPDATE quotations SET
         subtotal = COALESCE((SELECT SUM(quantity * unit_price) FROM quotation_items WHERE quotation_id = $1), 0),
         discount_total = COALESCE((SELECT SUM(discount_amount) FROM quotation_items WHERE quotation_id = $1), 0),
         tax_total = COALESCE((SELECT SUM(line_total - (quantity * unit_price - discount_amount)) FROM quotation_items WHERE quotation_id = $1), 0),
         grand_total = COALESCE((SELECT SUM(line_total) FROM quotation_items WHERE quotation_id = $1), 0)
       WHERE id = $1`,
      [quotationId],
    );
  },

  async updateQuotationStatus(
    client: PoolClient,
    quotationId: string,
    status: string,
  ): Promise<void> {
    await client.query('UPDATE quotations SET status = $2 WHERE id = $1', [quotationId, status]);
  },
};
