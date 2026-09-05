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

  // Regression coverage for the month-end overflow bug: a naive
  // setUTCMonth(month + 1) on Jan 31 produces "Feb 31", which JS normalizes
  // to Mar 2/3 — silently skipping a February billing cycle entirely.
  it('clamps to the last day of February for a MONTHLY cycle starting Jan 31 (non-leap year)', () => {
    expect(computeNextBillingDate(new Date('2026-01-31T00:00:00Z'), 'MONTHLY')).toBe('2026-02-28');
  });

  it('clamps to Feb 29 for a MONTHLY cycle starting Jan 31 in a leap year', () => {
    expect(computeNextBillingDate(new Date('2028-01-31T00:00:00Z'), 'MONTHLY')).toBe('2028-02-29');
  });

  it('clamps to the last day of the target month for a 31-day -> 30-day rollover', () => {
    expect(computeNextBillingDate(new Date('2026-08-31T00:00:00Z'), 'MONTHLY')).toBe('2026-09-30');
  });

  it('clamps correctly for a QUARTERLY cycle landing on a short month', () => {
    expect(computeNextBillingDate(new Date('2026-11-30T00:00:00Z'), 'QUARTERLY')).toBe('2027-02-28');
  });

  it('does not clamp when the target month has enough days', () => {
    expect(computeNextBillingDate(new Date('2026-03-31T00:00:00Z'), 'MONTHLY')).toBe('2026-04-30');
    expect(computeNextBillingDate(new Date('2026-01-15T00:00:00Z'), 'MONTHLY')).toBe('2026-02-15');
  });
});
