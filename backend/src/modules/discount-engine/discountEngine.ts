/**
 * Discount Rule Engine — pure business logic, no I/O.
 *
 * This is the single most important function in the codebase (see
 * docs/architecture.md § Discount Rule Engine). It is deliberately kept free
 * of database/HTTP concerns so it can be unit-tested directly against a
 * worked example before anything is wired to an endpoint
 * (docs/development-workflow.md Block 2).
 *
 * Ceilings are per-product, per-category, and per-customer-tier
 * (`discount_rules` with nullable scope columns) — never a flat role-based
 * limit. Every item is checked against the *strictest applicable rule*
 * across whichever scopes match it (docs/requirements.md FR2).
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ItemDecision = 'AUTO_APPROVED' | 'REQUIRES_APPROVAL';

export interface DiscountRuleInput {
  productId: string | null;
  categoryId: string | null;
  customerTierId: string | null;
  maxDiscount: number;
  active: boolean;
}

export interface QuotationItemInput {
  /** quotation_items.id */
  id: string;
  productId: string;
  categoryId: string;
  discountPercent: number;
}

export interface ItemEvaluation {
  quotationItemId: string;
  requestedDiscount: number;
  allowedDiscount: number;
  overBy: number;
  riskScore: number;
  riskLevel: RiskLevel;
  decision: ItemDecision;
}

export interface DiscountEvaluationResult {
  items: ItemEvaluation[];
  blendedScore: number;
  riskLevel: RiskLevel;
}

/** Blended-score band boundaries. Tunable v1 heuristic — see module docstring. */
export const MEDIUM_RISK_THRESHOLD = 30;

/**
 * Resolves the strictest applicable ceiling for one item: the minimum
 * `maxDiscount` across every active rule whose scope matches this item
 * (by product, by category, by customer tier, or a fully-global rule with
 * no scope at all).
 *
 * Safe-by-default: if no rule matches, the ceiling is 0 (no discount is
 * permitted until an admin explicitly configures a rule) rather than
 * implicitly allowing an unlimited discount.
 */
export function resolveEffectiveCeiling(
  item: QuotationItemInput,
  rules: DiscountRuleInput[],
  customerTierId: string
): number {
  const candidates = rules.filter((rule) => {
    if (!rule.active) return false;
    const isGlobal = !rule.productId && !rule.categoryId && !rule.customerTierId;
    return (
      isGlobal ||
      rule.productId === item.productId ||
      rule.categoryId === item.categoryId ||
      rule.customerTierId === customerTierId
    );
  });

  if (candidates.length === 0) return 0;
  return Math.min(...candidates.map((rule) => rule.maxDiscount));
}

function bandForOverage(overBy: number): RiskLevel {
  if (overBy <= 0) return 'LOW';
  if (overBy <= 10) return 'MEDIUM';
  return 'HIGH';
}

function evaluateItem(
  item: QuotationItemInput,
  rules: DiscountRuleInput[],
  customerTierId: string
): ItemEvaluation {
  const allowedDiscount = resolveEffectiveCeiling(item, rules, customerTierId);
  const overBy = Math.max(0, item.discountPercent - allowedDiscount);

  return {
    quotationItemId: item.id,
    requestedDiscount: item.discountPercent,
    allowedDiscount,
    overBy,
    riskScore: Math.min(100, overBy * 2),
    riskLevel: bandForOverage(overBy),
    decision: overBy === 0 ? 'AUTO_APPROVED' : 'REQUIRES_APPROVAL',
  };
}

function blendedRiskLevel(score: number): RiskLevel {
  if (score <= 0) return 'LOW';
  if (score <= MEDIUM_RISK_THRESHOLD) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Evaluates every line of a quotation against the discount rules that apply
 * to it, then combines the per-item results into one blended risk score for
 * the whole quotation (FR3).
 *
 * blendedScore weighs three signals equally described in
 * docs/architecture.md: total overage across the order, how many lines
 * violate their ceiling, and the single worst line — so one badly
 * over-discounted line and several mildly over-discounted lines can both
 * trigger approval, for different reasons.
 */
export function evaluateQuotationDiscounts(
  items: QuotationItemInput[],
  rules: DiscountRuleInput[],
  customerTierId: string
): DiscountEvaluationResult {
  const itemEvaluations = items.map((item) => evaluateItem(item, rules, customerTierId));

  const totalOverage = itemEvaluations.reduce((sum, e) => sum + e.overBy, 0);
  const violationCount = itemEvaluations.filter((e) => e.overBy > 0).length;
  const worstOverage = itemEvaluations.reduce((max, e) => Math.max(max, e.overBy), 0);

  const blendedScore = Math.min(100, worstOverage * 2 + totalOverage * 0.5 + violationCount * 5);

  return {
    items: itemEvaluations,
    blendedScore,
    riskLevel: blendedRiskLevel(blendedScore),
  };
}
