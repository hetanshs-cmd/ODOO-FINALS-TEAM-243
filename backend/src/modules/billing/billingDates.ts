export type BillingFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const MONTHS_TO_ADD: Record<BillingFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/** Adds the plan's billing interval to `from`, returned as an ISO date string (YYYY-MM-DD). */
export function computeNextBillingDate(from: Date, frequency: BillingFrequency): string {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  next.setUTCMonth(next.getUTCMonth() + MONTHS_TO_ADD[frequency]);
  return next.toISOString().slice(0, 10);
}
