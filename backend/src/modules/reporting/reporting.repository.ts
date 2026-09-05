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
      conditions.push(`q.created_at >= $${params.length}`);
    }
    if (to) {
      // created_at is TIMESTAMPTZ; comparing it to a bare DATE truncates to
      // that date's midnight and silently excludes the entire `to` day.
      // Compare against the start of the NEXT day instead so `to` is inclusive.
      params.push(to);
      conditions.push(`q.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // quotations stores no totals (006_quotations.sql) — aggregate from
    // quotation_totals, the single canonical source for this money math.
    const { rows } = await db.query(
      `SELECT q.status,
              COUNT(*)::int AS quotation_count,
              COALESCE(SUM(qt.grand_total), 0)::float8 AS total_grand_total,
              COALESCE(AVG(qt.discount_total), 0)::float8 AS avg_discount_total
       FROM quotations q
       JOIN quotation_totals qt ON qt.quotation_id = q.id
       ${where}
       GROUP BY q.status
       ORDER BY q.status`,
      params,
    );
    return rows as SalesSummaryRow[];
  },

  /**
   * Quotations whose MOST RECENT evaluation per item is currently HIGH risk.
   *
   * Filtering `risk_level = 'HIGH'` before picking latest-per-item selected
   * the latest HIGH evaluation for each item, not the latest evaluation —
   * so a line renegotiated back into compliance (whose newest row is LOW/
   * MEDIUM) never left this report, because its only visible row was still
   * the old HIGH one. Picking latest-per-item FIRST, then filtering, means a
   * cleared item's current (non-HIGH) row is what gets compared and excluded.
   */
  async discountExceptions(limit: number, offset: number): Promise<DiscountExceptionRow[]> {
    const { rows } = await db.query(
      `SELECT quotation_id, quotation_number, customer_id, sales_rep_id,
              risk_level, requested_discount, allowed_discount, evaluated_at
       FROM (
         SELECT DISTINCT ON (de.quotation_id, de.quotation_item_id)
                q.id AS quotation_id, q.quotation_number, q.customer_id, q.sales_rep_id,
                de.risk_level, de.requested_discount, de.allowed_discount, de.evaluated_at
         FROM discount_evaluations de
         JOIN quotations q ON q.id = de.quotation_id
         ORDER BY de.quotation_id, de.quotation_item_id, de.evaluated_at DESC
       ) latest_per_item
       WHERE risk_level = 'HIGH'
       ORDER BY evaluated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows as DiscountExceptionRow[];
  },
};
