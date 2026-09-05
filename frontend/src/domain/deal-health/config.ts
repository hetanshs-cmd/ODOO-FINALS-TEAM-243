/**
 * DealFlow360 — Deal Health & Anomaly Configuration
 * Centralized, configurable thresholds for stalled deal detection,
 * rep-specific historical discount anomaly evaluation, and fulfillment slippage.
 */

export interface DealHealthConfiguration {
  stalledThresholdDays: number;
  stalledWarningDays: number;
  discountAnomalySpreadThresholdPts: number;
  discountAnomalyCriticalSpreadPts: number;
  deliverySlippageDaysThreshold: number;
  repDiscountBaselines: Record<string, number>;
}

export const DEFAULT_DEAL_HEALTH_CONFIG: DealHealthConfiguration = {
  // Stalled Deals: prompt requires inactivity beyond a configurable threshold (default 14 days)
  stalledThresholdDays: 14,
  stalledWarningDays: 7,

  // Discount Anomaly: prompt requires comparing against that rep's historical average
  discountAnomalySpreadThresholdPts: 5.0,
  discountAnomalyCriticalSpreadPts: 7.0,

  // Delivery Slippage: promised delivery date vs fulfillment & inventory availability
  deliverySlippageDaysThreshold: 14,

  // Canonical historical baseline discount % for sales reps
  repDiscountBaselines: {
    'USR-REP-01': 8.2, // Sarah Chen
    'Sarah Chen': 8.2,
    'USR-REP-02': 9.5, // Alex Rivera
    'Alex Rivera': 9.5,
    'USR-REP-03': 10.1, // Jordan Taylor
    'Jordan Taylor': 10.1,
  },
};
