/**
 * DealFlow360 — Discount Governance & Approval Engine
 * Pure deterministic domain functions for line validation, category ceilings, blended risk, and approval routing.
 */

import {
  CustomerTier,
  ProductCategory,
  QuotationLine,
  RiskLevel,
  CategoryDiscountRule,
  DiscountTierRule,
  ApprovalChainRule,
} from '../../types';

export const DEFAULT_TIER_RULES: DiscountTierRule[] = [
  { tier: 'Bronze', maxDiscountPercent: 5 },
  { tier: 'Silver', maxDiscountPercent: 10 },
  { tier: 'Gold', maxDiscountPercent: 15 },
];

export const DEFAULT_CATEGORY_RULES: CategoryDiscountRule[] = [
  { category: 'Hardware', maxDiscountPercent: 15 },
  { category: 'Services', maxDiscountPercent: 10 },
  { category: 'Subscription', maxDiscountPercent: 15 },
];

/**
 * Core Function #1: Compute Line Status
 * Compares discount against category/effective limit and returns status and overage.
 */
export function computeLineStatus(
  discountPercent: number,
  categoryLimitPercent: number
): { status: 'OK' | 'OVER'; overBy: number } {
  const overBy = Math.max(0, Number((discountPercent - categoryLimitPercent).toFixed(2)));
  return {
    status: overBy > 0 ? 'OVER' : 'OK',
    overBy,
  };
}

/**
 * Determines effective discount limit for a product line.
 * Stricter ceiling between customer tier and category ceiling.
 * e.g., Gold customer (15%) + Services (10%) -> effective ceiling is 10%!
 */
export function getEffectiveDiscountLimit(
  category: ProductCategory,
  customerTier: CustomerTier,
  categoryRules: CategoryDiscountRule[] = DEFAULT_CATEGORY_RULES,
  tierRules: DiscountTierRule[] = DEFAULT_TIER_RULES
): { effectiveLimit: number; governingRule: 'category' | 'tier'; categoryLimit: number; tierLimit: number } {
  const catRule = categoryRules.find((r) => r.category === category) || { maxDiscountPercent: 10 };
  const tRule = tierRules.find((r) => r.tier === customerTier) || { maxDiscountPercent: 5 };

  const categoryLimit = catRule.maxDiscountPercent;
  const tierLimit = tRule.maxDiscountPercent;

  if (categoryLimit <= tierLimit) {
    return {
      effectiveLimit: categoryLimit,
      governingRule: 'category',
      categoryLimit,
      tierLimit,
    };
  }

  return {
    effectiveLimit: tierLimit,
    governingRule: 'tier',
    categoryLimit,
    tierLimit,
  };
}

export interface BlendedRiskResult {
  level: RiskLevel;
  score: number;
  worstLineOverBy: number;
  totalOverBy: number;
  reasons: string[];
}

/**
 * Core Function #2: Compute Blended Risk
 * Evaluates both worst individual line violation and accumulated total violation.
 *
 * Rules:
 * - HIGH: Any single line is >= 8 percentage points over limit, OR aggregate violation >= 12 points.
 * - MEDIUM: Any line is over limit (worstLineOverBy > 0) or aggregate violation > 0.
 * - LOW: All lines within approved ceiling.
 */
export function computeBlendedRiskScore(lines: QuotationLine[]): BlendedRiskResult {
  if (!lines || lines.length === 0) {
    return {
      level: 'LOW',
      score: 10,
      worstLineOverBy: 0,
      totalOverBy: 0,
      reasons: ['Quotation has no active line items.'],
    };
  }

  let worstLineOverBy = 0;
  let totalOverBy = 0;
  const reasons: string[] = [];

  for (const line of lines) {
    const over = line.overBy ?? Math.max(0, line.discountPercent - line.categoryLimitPercent);
    if (over > worstLineOverBy) {
      worstLineOverBy = over;
    }
    if (over > 0) {
      totalOverBy += over;
      reasons.push(
        `${line.productName || 'Line item'}: ${line.discountPercent}% discount is ${over.toFixed(1)} pts above the ${line.categoryLimitPercent}% limit.`
      );
    }
  }

  totalOverBy = Number(totalOverBy.toFixed(2));
  worstLineOverBy = Number(worstLineOverBy.toFixed(2));

  // Determine Level & Score deterministically
  if (worstLineOverBy >= 8 || totalOverBy >= 12) {
    // HIGH Risk: Score scaled between 75 and 98
    const score = Math.min(98, Math.round(75 + (worstLineOverBy - 8) * 2.5 + totalOverBy));
    return {
      level: 'HIGH',
      score,
      worstLineOverBy,
      totalOverBy,
      reasons: [
        `Severe discount violation: single line exceeded ceiling by ${worstLineOverBy} percentage points (threshold: 8.0 pts).`,
        ...reasons,
      ],
    };
  }

  if (worstLineOverBy > 0 || totalOverBy > 0) {
    // MEDIUM Risk: Score scaled between 40 and 70
    const score = Math.min(70, Math.round(40 + worstLineOverBy * 3 + totalOverBy * 1.5));
    return {
      level: 'MEDIUM',
      score,
      worstLineOverBy,
      totalOverBy,
      reasons: [
        `Moderate discount exposure: ${totalOverBy.toFixed(1)} cumulative percentage points above baseline rules.`,
        ...reasons,
      ],
    };
  }

  return {
    level: 'LOW',
    score: 15,
    worstLineOverBy: 0,
    totalOverBy: 0,
    reasons: ['All order lines are fully compliant with customer tier and product category ceilings.'],
  };
}

/**
 * Core Function #3: Compute Required Approvers
 *
 * Configurable or default governance chain:
 * - LOW -> [] (No approval required)
 * - MEDIUM -> ['sales_manager']
 * - HIGH -> ['sales_manager', 'finance'] (Two-tier governance chain)
 */
export function computeRequiredApprovers(
  risk: BlendedRiskResult | RiskLevel,
  approvalRules?: ApprovalChainRule[]
): ('sales_manager' | 'finance')[] {
  const level = typeof risk === 'string' ? risk : risk.level;

  if (approvalRules && approvalRules.length > 0) {
    const targetRange =
      level === 'HIGH' ? 'over_limit_high' :
      level === 'MEDIUM' ? 'over_limit_medium' : 'within_limit';

    const matchedRule = approvalRules.find(
      (r) =>
        (r.active !== false) &&
        (r.discountRange === targetRange || (r.riskLevel && r.riskLevel === level))
    );

    if (matchedRule) {
      return matchedRule.requiredApprovers;
    }
  }

  switch (level) {
    case 'HIGH':
      return ['sales_manager', 'finance'];
    case 'MEDIUM':
      return ['sales_manager'];
    case 'LOW':
    default:
      return [];
  }
}

// Backward-compatible export
export const discountEngine = {
  validateLineDiscount(category: ProductCategory, tier: CustomerTier, discountPercent: number) {
    const { effectiveLimit, governingRule } = getEffectiveDiscountLimit(category, tier);
    const { status, overBy } = computeLineStatus(discountPercent, effectiveLimit);
    return {
      allowedLimitPercent: effectiveLimit,
      overByPoints: overBy,
      isOverLimit: status === 'OVER',
      governingCeilingType: governingRule === 'category' ? 'Category' : 'CustomerTier',
      explanation: `Evaluated against ${category} (${effectiveLimit}%) and ${tier} tier limit.`,
    };
  },
  calculateBlendedRisk(lines: QuotationLine[]) {
    const evalResult = computeBlendedRiskScore(lines);
    return {
      score: evalResult.score,
      level: evalResult.level,
      requiresApproval: evalResult.level !== 'LOW',
      contributingLinesCount: lines.filter((l) => (l.overBy ?? 0) > 0).length,
      rationale: evalResult.reasons[0] || 'Compliant',
    };
  },
};
