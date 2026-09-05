import { db } from '../../config/database';

export interface SalesSummaryRow {
  status: string;
  quotation_count: number;
  total_grand_total: number;
  avg_discount_total: number;
}

export interface DiscountExceptionRow {
  quotation_id: string;
  quotation_number: string;
  customer_id: string;
  sales_rep_id: string;
  risk_level: string;
  requested_discount: string;
  allowed_discount: string;
  evaluated_at: string;
}

export const reportingRepository = {
  async salesSummary(from: string | undefined, to: string | undefined): Promise<SalesSummaryRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (from) {
      params.push(from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`created_at <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT status,
              COUNT(*)::int AS quotation_count,
              COALESCE(SUM(grand_total), 0)::float8 AS total_grand_total,
              COALESCE(AVG(discount_total), 0)::float8 AS avg_discount_total
       FROM quotations
       ${where}
       GROUP BY status
       ORDER BY status`,
      params
    );
    return rows as SalesSummaryRow[];
  },

  /** Quotations whose most recent evaluation per item came back HIGH risk — kept raw/unformatted per the cut list. */
  async discountExceptions(limit: number, offset: number): Promise<DiscountExceptionRow[]> {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (de.quotation_id, de.quotation_item_id)
              q.id AS quotation_id, q.quotation_number, q.customer_id, q.sales_rep_id,
              de.risk_level, de.requested_discount, de.allowed_discount, de.evaluated_at
       FROM discount_evaluations de
       JOIN quotations q ON q.id = de.quotation_id
       WHERE de.risk_level = 'HIGH'
       ORDER BY de.quotation_id, de.quotation_item_id, de.evaluated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows as DiscountExceptionRow[];
  },
};
