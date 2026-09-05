/**
 * Credit-note refund calculator — pure business logic, no I/O, mirroring
 * discountEngine.ts's separation of pure calculation from persistence so
 * this can be unit-tested directly (docs/development-workflow.md Block 2).
 *
 * Used by subscriptions.service.ts for both a plan downgrade (refund the
 * unused portion of the price delta for the remainder of the current
 * cycle) and a full cancellation (refund the unused portion of the whole
 * current_price for the remainder of the cycle). Both are the same
 * Ghost-style "days_remaining / total_days * amount" proration already used
 * for upgrade charges in subscriptions.service.ts's prorateForCycle, just
 * applied in the opposite direction (money owed back, not billed).
 */

export type BillingFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export const CYCLE_DAYS: Record<BillingFrequency, number> = {
  MONTHLY: 30,
  QUARTERLY: 91,
  YEARLY: 365,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CalculateRefundInput {
  /** The amount to prorate: abs(priceDelta) for a downgrade, current_price for a cancellation. */
  amount: number;
  /** subscriptions.next_billing_date — null means no active cycle to refund against. */
  nextBillingDate: string | null;
  billingFrequency: BillingFrequency;
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
}

/**
 * Returns 0 when there's nothing to refund: a non-positive amount, no active
 * billing cycle (nextBillingDate null), or a cycle that has already lapsed.
 */
export function calculateRefund(input: CalculateRefundInput): number {
  const { amount, nextBillingDate, billingFrequency } = input;
  if (amount <= 0 || !nextBillingDate) return 0;

  const totalDays = CYCLE_DAYS[billingFrequency];
  const next = new Date(`${nextBillingDate}T00:00:00Z`).getTime();
  const now = (input.now ?? new Date()).getTime();
  const daysRemaining = Math.max(0, Math.min(totalDays, Math.round((next - now) / MS_PER_DAY)));
  if (daysRemaining <= 0) return 0;

  return Math.round((amount * (daysRemaining / totalDays) + Number.EPSILON) * 100) / 100;
}
