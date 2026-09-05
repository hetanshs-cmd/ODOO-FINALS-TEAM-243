export type BillingFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const MONTHS_TO_ADD: Record<BillingFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/** Last day of the given zero-indexed UTC month — day 0 of the next month. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds the plan's billing interval to `from`, returned as an ISO date string
 * (YYYY-MM-DD).
 *
 * The day-of-month is clamped to the target month's length. A naive
 * `setUTCMonth(month + 1)` overflows — Jan 31 becomes "Feb 31", which the
 * Date constructor normalises to Mar 2/3, silently skipping February and
 * billing a cycle late. Jan 31 + 1 month is Feb 28 (or 29 in a leap year).
 */
export function computeNextBillingDate(from: Date, frequency: BillingFrequency): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  const targetMonthAbsolute = month + MONTHS_TO_ADD[frequency];
  const targetYear = year + Math.floor(targetMonthAbsolute / 12);
  const targetMonth = ((targetMonthAbsolute % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}
