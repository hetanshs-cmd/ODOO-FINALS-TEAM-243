import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { DiscountRuleInput, ItemEvaluation, QuotationItemInput } from './discountEngine';
import { DiscountEvaluationRow } from './discount-engine.model';

export interface QuotationForEvaluation {
  id: string;
  status: string;
  sales_rep_id: string;
  customer_tier_id: string;
}

export const discountEngineRepository = {
  /** Loads the quotation plus its customer's tier — needed to resolve tier-scoped rules. */
  async findQuotationWithTier(quotationId: string): Promise<QuotationForEvaluation | null> {
    const { rows } = await db.query(
      `SELECT q.id, q.status, q.sales_rep_id, c.customer_tier_id
       FROM quotations q
       JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1`,
      [quotationId]
    );
    return (rows[0] as QuotationForEvaluation | undefined) ?? null;
  },

  /** Loads each item with its product's category — the scope discount_rules match on. */
  async findItemsForEvaluation(quotationId: string): Promise<QuotationItemInput[]> {
    const { rows } = await db.query(
      `SELECT qi.id, qi.product_id AS "productId", p.category_id AS "categoryId",
              qi.discount_percent::float8 AS "discountPercent"
       FROM quotation_items qi
       JOIN products p ON p.id = qi.product_id
       WHERE qi.quotation_id = $1`,
      [quotationId]
    );
    return rows as QuotationItemInput[];
  },

  async findActiveDiscountRules(): Promise<DiscountRuleInput[]> {
    const { rows } = await db.query(
      `SELECT product_id AS "productId", category_id AS "categoryId",
              customer_tier_id AS "customerTierId", max_discount::float8 AS "maxDiscount",
              priority, active
       FROM discount_rules
       WHERE active = true`
    );
    return rows as DiscountRuleInput[];
  },

  async insertEvaluation(
    client: PoolClient,
    quotationId: string,
    evaluation: ItemEvaluation
  ): Promise<DiscountEvaluationRow> {
    const { rows } = await client.query(
      `INSERT INTO discount_evaluations
         (quotation_id, quotation_item_id, requested_discount, allowed_discount,
          risk_score, risk_level, decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        quotationId,
        evaluation.quotationItemId,
        evaluation.requestedDiscount,
        evaluation.allowedDiscount,
        evaluation.riskScore,
        evaluation.riskLevel,
        evaluation.decision,
      ]
    );
    return rows[0] as DiscountEvaluationRow;
  },

  async updateQuotationStatus(
    client: PoolClient,
    quotationId: string,
    status: string
  ): Promise<void> {
    await client.query('UPDATE quotations SET status = $2 WHERE id = $1', [quotationId, status]);
  },

  /** Locks the quotation row so the status re-check and write are atomic. */
  async lockQuotationStatus(client: PoolClient, quotationId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT status FROM quotations WHERE id = $1 FOR UPDATE',
      [quotationId]
    );
    return (rows[0] as { status: string } | undefined)?.status ?? null;
  },

  /**
   * Cancels any still-PENDING approval request on this quotation before a new
   * one is raised. Re-running the discount check (which every counter-offer
   * does) previously stacked a fresh PENDING request on top of the old one,
   * so one quotation could occupy several slots in the approval queue.
   */
  async supersedePendingApprovalRequests(
    client: PoolClient,
    quotationId: string
  ): Promise<number> {
    const { rowCount } = await client.query(
      `UPDATE approval_requests
       SET status = 'CANCELLED', responded_at = now()
       WHERE quotation_id = $1 AND status = 'PENDING'`,
      [quotationId]
    );
    return rowCount ?? 0;
  },

  async createApprovalRequest(
    client: PoolClient,
    input: { quotationId: string; requestedBy: string; approvalLevelId: string; reason: string }
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO approval_requests (quotation_id, requested_by, approval_level_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.quotationId, input.requestedBy, input.approvalLevelId, input.reason]
    );
    return (rows[0] as { id: string }).id;
  },
};
