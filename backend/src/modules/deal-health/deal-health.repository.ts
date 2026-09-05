import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { DealAlertRow, DealHealthScoreRow } from './deal-health.model';
import { AlertSeverity, AlertType } from './dealHealth';

export interface QuotationForHealth {
  id: string;
  updated_at: string;
}

export const dealHealthRepository = {
  async findQuotationForHealth(quotationId: string): Promise<QuotationForHealth | null> {
    const { rows } = await db.query('SELECT id, updated_at FROM quotations WHERE id = $1', [
      quotationId,
    ]);
    return (rows[0] as QuotationForHealth | undefined) ?? null;
  },

  /** Average risk_score across each item's most recent evaluation (0 if never evaluated). */
  async findLatestDiscountRiskScore(quotationId: string): Promise<number> {
    const { rows } = await db.query(
      `SELECT COALESCE(AVG(latest.risk_score), 0)::float8 AS avg_risk
       FROM (
         SELECT DISTINCT ON (quotation_item_id) risk_score
         FROM discount_evaluations
         WHERE quotation_id = $1
         ORDER BY quotation_item_id, evaluated_at DESC
       ) latest`,
      [quotationId],
    );
    return (rows[0] as { avg_risk: number }).avg_risk;
  },

  async countNegotiationRounds(quotationId: string): Promise<number> {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM negotiation_messages nm
       JOIN negotiations n ON n.id = nm.negotiation_id
       WHERE n.quotation_id = $1 AND nm.message_type = 'COUNTER_OFFER'`,
      [quotationId],
    );
    return (rows[0] as { count: number }).count;
  },

  /** Max days a still-open fulfillment for this quotation's sales order has slipped past its schedule. */
  async findFulfillmentDelayDays(quotationId: string): Promise<number> {
    const { rows } = await db.query(
      `SELECT COALESCE(MAX(GREATEST(0, (CURRENT_DATE - f.scheduled_date))), 0)::int AS delay_days
       FROM fulfillments f
       JOIN sales_orders so ON so.id = f.sales_order_id
       WHERE so.quotation_id = $1
         AND f.status NOT IN ('DELIVERED', 'CANCELLED')
         AND f.scheduled_date IS NOT NULL`,
      [quotationId],
    );
    return (rows[0] as { delay_days: number }).delay_days;
  },

  async insertScore(
    client: PoolClient,
    input: {
      quotationId: string;
      score: number;
      riskLevel: string;
      discountRisk: number;
      negotiationRisk: number;
      delayRisk: number;
      fulfillmentRisk: number;
    },
  ): Promise<DealHealthScoreRow> {
    const { rows } = await client.query(
      `INSERT INTO deal_health_scores
         (quotation_id, score, risk_level, discount_risk, negotiation_risk, delay_risk, fulfillment_risk)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.quotationId,
        input.score,
        input.riskLevel,
        input.discountRisk,
        input.negotiationRisk,
        input.delayRisk,
        input.fulfillmentRisk,
      ],
    );
    return rows[0] as DealHealthScoreRow;
  },

  async findOpenAlertOfType(
    quotationId: string,
    alertType: AlertType,
  ): Promise<DealAlertRow | null> {
    const { rows } = await db.query(
      `SELECT * FROM deal_alerts WHERE quotation_id = $1 AND alert_type = $2 AND status = 'OPEN'`,
      [quotationId, alertType],
    );
    return (rows[0] as DealAlertRow | undefined) ?? null;
  },

  async insertAlert(
    client: PoolClient,
    input: { quotationId: string; alertType: AlertType; severity: AlertSeverity; message: string },
  ): Promise<DealAlertRow> {
    const { rows } = await client.query(
      `INSERT INTO deal_alerts (quotation_id, alert_type, severity, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.quotationId, input.alertType, input.severity, input.message],
    );
    return rows[0] as DealAlertRow;
  },

  async findLatestScore(quotationId: string): Promise<DealHealthScoreRow | null> {
    const { rows } = await db.query(
      'SELECT * FROM deal_health_scores WHERE quotation_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [quotationId],
    );
    return (rows[0] as DealHealthScoreRow | undefined) ?? null;
  },

  async listOpenAlertsForQuotation(quotationId: string): Promise<DealAlertRow[]> {
    const { rows } = await db.query(
      `SELECT * FROM deal_alerts WHERE quotation_id = $1 AND status = 'OPEN' ORDER BY created_at DESC`,
      [quotationId],
    );
    return rows as DealAlertRow[];
  },

  async listOpenAlerts(
    limit: number,
    offset: number,
  ): Promise<(DealAlertRow & { quotation_number: string })[]> {
    const { rows } = await db.query(
      `SELECT da.*, q.quotation_number
       FROM deal_alerts da
       JOIN quotations q ON q.id = da.quotation_id
       WHERE da.status = 'OPEN'
       ORDER BY da.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows as (DealAlertRow & { quotation_number: string })[];
  },

  async countOpenAlerts(): Promise<number> {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count FROM deal_alerts WHERE status = 'OPEN'`,
    );
    return (rows[0] as { count: number }).count;
  },

  async updateAlertStatus(
    alertId: string,
    status: 'ESCALATED' | 'NUDGED' | 'RESOLVED',
  ): Promise<DealAlertRow | null> {
    const { rows } = await db.query(
      `UPDATE deal_alerts SET status = $2, resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
       WHERE id = $1 RETURNING *`,
      [alertId, status],
    );
    return (rows[0] as DealAlertRow | undefined) ?? null;
  },
};
