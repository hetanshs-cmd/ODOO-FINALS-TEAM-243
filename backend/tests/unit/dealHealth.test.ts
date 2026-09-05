import { describe, expect, it } from 'vitest';
import { calculateDealHealth } from '../../src/modules/deal-health/dealHealth';

describe('calculateDealHealth', () => {
  it('scores a healthy, freshly-updated quotation as LOW risk with no alerts', () => {
    const result = calculateDealHealth({
      latestDiscountRiskScore: 0,
      negotiationRoundCount: 0,
      daysSinceLastActivity: 0,
      fulfillmentDelayDays: 0,
    });

    expect(result.riskLevel).toBe('LOW');
    expect(result.score).toBe(100);
    expect(result.alerts).toHaveLength(0);
  });

  it('flags STALLED when there has been no activity for 5+ days', () => {
    const result = calculateDealHealth({
      latestDiscountRiskScore: 0,
      negotiationRoundCount: 0,
      daysSinceLastActivity: 6,
      fulfillmentDelayDays: 0,
    });

    expect(result.alerts).toEqual([
      { type: 'STALLED', severity: 'MEDIUM', message: 'No activity for 6 day(s)' },
    ]);
  });

  it('flags DISCOUNT_ANOMALY as CRITICAL when discount risk is very high', () => {
    const result = calculateDealHealth({
      latestDiscountRiskScore: 90,
      negotiationRoundCount: 0,
      daysSinceLastActivity: 0,
      fulfillmentDelayDays: 0,
    });

    expect(result.alerts).toContainEqual({
      type: 'DISCOUNT_ANOMALY',
      severity: 'CRITICAL',
      message: 'Discount risk score is 90',
    });
    // The alert fires straight off the raw discountRisk factor; the blended
    // composite riskLevel (discount only weighted 0.3) can still land LOW
    // when every other factor is 0 — alerts and riskLevel are independent signals.
    expect(result.riskLevel).toBe('LOW');
  });

  it('flags DELIVERY_SLIPPAGE once a fulfillment has slipped 3+ days', () => {
    const result = calculateDealHealth({
      latestDiscountRiskScore: 0,
      negotiationRoundCount: 0,
      daysSinceLastActivity: 0,
      fulfillmentDelayDays: 4,
    });

    expect(result.alerts).toEqual([
      { type: 'DELIVERY_SLIPPAGE', severity: 'MEDIUM', message: 'Fulfillment is delayed by 4 day(s)' },
    ]);
  });

  it('blends multiple risk factors into a single composite score', () => {
    const result = calculateDealHealth({
      latestDiscountRiskScore: 40,
      negotiationRoundCount: 3,
      daysSinceLastActivity: 2,
      fulfillmentDelayDays: 0,
    });

    // discount 40*0.3 + negotiation 45*0.2 + delay 20*0.25 = 12 + 9 + 5 = 26 -> below the 30 MEDIUM threshold
    expect(result.riskLevel).toBe('LOW');
    expect(result.score).toBeCloseTo(74, 0);
  });
});
