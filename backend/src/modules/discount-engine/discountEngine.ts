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

// Note: discount_rules also has min_discount, approval_required,
// approval_level and sales_role columns — these are reserved for future use
// and deliberately not read by this evaluation engine (a decision, not an
// oversight). `priority` IS read, as the tie-break between rules that apply
// at the same specificity.
export interface DiscountRuleInput {
  productId: string | null;
  categoryId: string | null;
  customerTierId: string | null;
  maxDiscount: number;
  active: boolean;
  /** discount_rules.priority — higher wins among equally specific rules. */
  priority?: number;
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
 * Does every scope this rule declares match this item?
 *
 * `discount_rules` lets product_id / category_id / customer_tier_id be set
 * independently, so a rule can be compound ("product P1, but only for GOLD
 * customers"). A non-null column is a REQUIREMENT, not an alternative: the
 * rule applies only when all of its declared scopes match. A rule with no
 * scope columns set is global and matches everything.
 *
 * This previously OR-ed the scopes, which meant a compound "P1 + GOLD" rule
 * also applied to every other product bought by a GOLD customer, and to P1
 * bought by every other tier — silently capping unrelated lines.
 */
function ruleApplies(
  rule: DiscountRuleInput,
  item: QuotationItemInput,
  customerTierId: string,
): boolean {
  if (!rule.active) return false;
  if (rule.productId !== null && rule.productId !== item.productId) return false;
  if (rule.categoryId !== null && rule.categoryId !== item.categoryId) return false;
  if (rule.customerTierId !== null && rule.customerTierId !== customerTierId) return false;
  return true;
}

/** How narrowly a rule is scoped. More specific rules win over broader ones. */
function specificity(rule: DiscountRuleInput): number {
  return (
    (rule.productId !== null ? 4 : 0) +
    (rule.categoryId !== null ? 2 : 0) +
    (rule.customerTierId !== null ? 1 : 0)
  );
}

/**
 * Resolves the effective ceiling for one item.
 *
 * Precedence: the most specific applicable rule wins (product > category >
 * tier > global). Among rules of equal specificity, the highest `priority`
 * wins; if priority ties too, the strictest (lowest) ceiling wins so a tie
 * can never loosen governance.
 *
 * Safe-by-default: if no rule matches, the ceiling is 0 (no discount is
 * permitted until an admin explicitly configures a rule) rather than
 * implicitly allowing an unlimited discount.
 */
export function resolveEffectiveCeiling(
  item: QuotationItemInput,
  rules: DiscountRuleInput[],
  customerTierId: string,
): number {
  const candidates = rules.filter((rule) => ruleApplies(rule, item, customerTierId));
  if (candidates.length === 0) return 0;

  let best = candidates[0]!;
  for (const rule of candidates.slice(1)) {
    const bestSpecificity = specificity(best);
    const ruleSpecificity = specificity(rule);
    if (ruleSpecificity !== bestSpecificity) {
      if (ruleSpecificity > bestSpecificity) best = rule;
      continue;
    }
    const bestPriority = best.priority ?? 0;
    const rulePriority = rule.priority ?? 0;
    if (rulePriority !== bestPriority) {
      if (rulePriority > bestPriority) best = rule;
      continue;
    }
    if (rule.maxDiscount < best.maxDiscount) best = rule;
  }

  return best.maxDiscount;
}

function bandForOverage(overBy: number): RiskLevel {
  if (overBy <= 0) return 'LOW';
  if (overBy <= 10) return 'MEDIUM';
  return 'HIGH';
}

function evaluateItem(
  item: QuotationItemInput,
  rules: DiscountRuleInput[],
  customerTierId: string,
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
  customerTierId: string,
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
