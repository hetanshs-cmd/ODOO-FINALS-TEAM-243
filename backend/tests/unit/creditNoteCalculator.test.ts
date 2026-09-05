import { describe, it, expect } from 'vitest';
import { calculateRefund } from '../../src/modules/subscriptions/creditNoteCalculator';

describe('calculateRefund', () => {
  it('returns 0 for a non-positive amount', () => {
    expect(
      calculateRefund({ amount: 0, nextBillingDate: '2026-10-01', billingFrequency: 'MONTHLY' }),
    ).toBe(0);
    expect(
      calculateRefund({ amount: -10, nextBillingDate: '2026-10-01', billingFrequency: 'MONTHLY' }),
    ).toBe(0);
  });

  it('returns 0 when there is no active billing cycle', () => {
    expect(
      calculateRefund({ amount: 100, nextBillingDate: null, billingFrequency: 'MONTHLY' }),
    ).toBe(0);
  });

  it('returns 0 when the cycle has already lapsed', () => {
    expect(
      calculateRefund({
        amount: 100,
        nextBillingDate: '2020-01-01',
        billingFrequency: 'MONTHLY',
        now: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toBe(0);
  });

  it('prorates the refund by days remaining in the cycle', () => {
    // 15 of 30 days remaining on a monthly cycle -> half the amount back.
    const refund = calculateRefund({
      amount: 100,
      nextBillingDate: '2026-01-16',
      billingFrequency: 'MONTHLY',
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(refund).toBe(50);
  });

  it('caps days remaining at the cycle length', () => {
    const refund = calculateRefund({
      amount: 100,
      nextBillingDate: '2027-01-01',
      billingFrequency: 'MONTHLY',
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(refund).toBe(100);
  });
});
