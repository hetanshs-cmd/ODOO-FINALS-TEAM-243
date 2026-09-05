/**
 * Pure deal-health scoring function — no DB/HTTP imports, unit-tested in
 * isolation before being wired to the recalculate endpoint (same
 * pure-function-first approach as discount-engine and warehouseAllocation).
 *
 * Four risk factors, each 0-100, blended into one composite score:
 *   - discountRisk: how far the latest discount evaluation exceeded ceilings
 *   - negotiationRisk: how many negotiation rounds have happened
 *   - delayRisk: days since the quotation last changed
 *   - fulfillmentRisk: days a scheduled fulfillment has slipped
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertType = 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DealHealthInput {
  latestDiscountRiskScore: number;
  negotiationRoundCount: number;
  daysSinceLastActivity: number;
  fulfillmentDelayDays: number;
}

export interface DealAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
}

export interface DealHealthResult {
  discountRisk: number;
  negotiationRisk: number;
  delayRisk: number;
  fulfillmentRisk: number;
  score: number;
  riskLevel: RiskLevel;
  alerts: DealAlert[];
}

const STALLED_DAYS_THRESHOLD = 5;
const SLIPPAGE_DAYS_THRESHOLD = 3;
const HIGH_RISK_THRESHOLD = 60;
const MEDIUM_RISK_THRESHOLD = 30;

const WEIGHTS = { discount: 0.3, negotiation: 0.2, delay: 0.25, fulfillment: 0.25 };

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function calculateDealHealth(input: DealHealthInput): DealHealthResult {
  const discountRisk = clamp(input.latestDiscountRiskScore);
  const negotiationRisk = clamp(input.negotiationRoundCount * 15);
  const delayRisk = clamp(input.daysSinceLastActivity * 10);
  const fulfillmentRisk = clamp(input.fulfillmentDelayDays * 20);

  const compositeRisk =
    discountRisk * WEIGHTS.discount +
    negotiationRisk * WEIGHTS.negotiation +
    delayRisk * WEIGHTS.delay +
    fulfillmentRisk * WEIGHTS.fulfillment;

  const score = clamp(100 - compositeRisk);
  const riskLevel: RiskLevel =
    compositeRisk >= HIGH_RISK_THRESHOLD
      ? 'HIGH'
      : compositeRisk >= MEDIUM_RISK_THRESHOLD
        ? 'MEDIUM'
        : 'LOW';

  const alerts: DealAlert[] = [];
  if (input.daysSinceLastActivity >= STALLED_DAYS_THRESHOLD) {
    alerts.push({
      type: 'STALLED',
      severity: input.daysSinceLastActivity >= STALLED_DAYS_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM',
      message: `No activity for ${input.daysSinceLastActivity} day(s)`,
    });
  }
  if (discountRisk >= HIGH_RISK_THRESHOLD) {
    alerts.push({
      type: 'DISCOUNT_ANOMALY',
      severity: discountRisk >= 85 ? 'CRITICAL' : 'HIGH',
      message: `Discount risk score is ${discountRisk}`,
    });
  }
  if (input.fulfillmentDelayDays >= SLIPPAGE_DAYS_THRESHOLD) {
    alerts.push({
      type: 'DELIVERY_SLIPPAGE',
      severity: input.fulfillmentDelayDays >= SLIPPAGE_DAYS_THRESHOLD * 2 ? 'CRITICAL' : 'MEDIUM',
      message: `Fulfillment is delayed by ${input.fulfillmentDelayDays} day(s)`,
    });
  }

  return { discountRisk, negotiationRisk, delayRisk, fulfillmentRisk, score, riskLevel, alerts };
}
