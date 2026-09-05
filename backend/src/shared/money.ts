/**
 * Rounds to 2 decimal places using standard half-up rounding, matching the
 * NUMERIC(14,2) columns every money value is stored in. Do all monetary
 * arithmetic in the service layer through this helper — never let floating
 * point drift (e.g. 19.999999999998) reach a query parameter.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
