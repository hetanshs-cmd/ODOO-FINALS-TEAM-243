import { describe, expect, it } from 'vitest';
import { computeNextBillingDate } from '../../src/modules/billing/billingDates';

describe('computeNextBillingDate', () => {
  it('adds one month for MONTHLY', () => {
    expect(computeNextBillingDate(new Date('2026-01-15T00:00:00Z'), 'MONTHLY')).toBe('2026-02-15');
  });

  it('adds three months for QUARTERLY', () => {
    expect(computeNextBillingDate(new Date('2026-01-15T00:00:00Z'), 'QUARTERLY')).toBe('2026-04-15');
  });

  it('adds twelve months for YEARLY', () => {
    expect(computeNextBillingDate(new Date('2026-01-15T00:00:00Z'), 'YEARLY')).toBe('2027-01-15');
  });

  it('rolls over year boundaries correctly', () => {
    expect(computeNextBillingDate(new Date('2026-12-05T00:00:00Z'), 'MONTHLY')).toBe('2027-01-05');
  });
});
