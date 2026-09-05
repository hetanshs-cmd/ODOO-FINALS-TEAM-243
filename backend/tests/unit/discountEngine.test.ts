import { describe, it, expect } from 'vitest';
import {
  evaluateQuotationDiscounts,
  resolveEffectiveCeiling,
  DiscountRuleInput,
  QuotationItemInput,
} from '../../src/modules/discount-engine/discountEngine';

/**
 * Worked example (docs/development-workflow.md Block 2): a Gold customer
 * quoting a Hardware line at 12% (ceiling 15% — OK) and a Services line at
 * 18% (ceiling 10% — over by 8).
 */
describe('evaluateQuotationDiscounts — worked example', () => {
  const GOLD_TIER_ID = 'tier-gold';
  const HARDWARE_CATEGORY_ID = 'cat-hardware';
  const SERVICES_CATEGORY_ID = 'cat-services';

  const rules: DiscountRuleInput[] = [
    {
      productId: null,
      categoryId: HARDWARE_CATEGORY_ID,
      customerTierId: null,
      maxDiscount: 15,
      active: true,
    },
    {
      productId: null,
      categoryId: SERVICES_CATEGORY_ID,
      customerTierId: null,
      maxDiscount: 10,
      active: true,
    },
  ];

  const items: QuotationItemInput[] = [
    {
      id: 'item-hardware',
      productId: 'prod-hardware-1',
      categoryId: HARDWARE_CATEGORY_ID,
      discountPercent: 12,
    },
    {
      id: 'item-services',
      productId: 'prod-services-1',
      categoryId: SERVICES_CATEGORY_ID,
      discountPercent: 18,
    },
  ];

  it('allows the Hardware line — 12% requested is within the 15% ceiling', () => {
    const result = evaluateQuotationDiscounts(items, rules, GOLD_TIER_ID);
    const hardware = result.items.find((i) => i.quotationItemId === 'item-hardware');

    expect(hardware).toMatchObject({
      allowedDiscount: 15,
      overBy: 0,
      decision: 'AUTO_APPROVED',
      riskLevel: 'LOW',
    });
  });

  it('flags the Services line — 18% requested is over the 10% ceiling by 8', () => {
    const result = evaluateQuotationDiscounts(items, rules, GOLD_TIER_ID);
    const services = result.items.find((i) => i.quotationItemId === 'item-services');

    expect(services).toMatchObject({
      allowedDiscount: 10,
      overBy: 8,
      decision: 'REQUIRES_APPROVAL',
    });
  });

  it('routes the whole quotation to approval since at least one line violates its ceiling', () => {
    const result = evaluateQuotationDiscounts(items, rules, GOLD_TIER_ID);

    expect(result.blendedScore).toBeGreaterThan(0);
    expect(result.riskLevel).not.toBe('LOW');
  });

  it('auto-approves when every line is within its ceiling', () => {
    const compliantItems: QuotationItemInput[] = [
      { id: 'item-1', productId: 'p1', categoryId: HARDWARE_CATEGORY_ID, discountPercent: 5 },
    ];
    const result = evaluateQuotationDiscounts(compliantItems, rules, GOLD_TIER_ID);

    expect(result.blendedScore).toBe(0);
    expect(result.riskLevel).toBe('LOW');
    expect(result.items[0]?.decision).toBe('AUTO_APPROVED');
  });
});

describe('resolveEffectiveCeiling', () => {
  const item: QuotationItemInput = {
    id: 'item-1',
    productId: 'prod-1',
    categoryId: 'cat-1',
    discountPercent: 10,
  };

  it('returns 0 (deny by default) when no rule matches the item', () => {
    expect(resolveEffectiveCeiling(item, [], 'tier-1')).toBe(0);
  });

  it('picks the more specific rule when two independently-scoped rules both match', () => {
    // A category rule and a tier rule that each match this item on their own
    // scope are NOT the same governance case — the more specific one (here,
    // category: productId null but categoryId set = specificity 2) wins over
    // the broader one (tier only = specificity 1). This used to take
    // Math.min() across every independently-matching rule, so a rule scoped
    // to an unrelated tier could tighten (or loosen) a ceiling for a
    // category it says nothing about.
    const rules: DiscountRuleInput[] = [
      { productId: null, categoryId: 'cat-1', customerTierId: null, maxDiscount: 20, active: true },
      { productId: null, categoryId: null, customerTierId: 'tier-1', maxDiscount: 8, active: true },
    ];

    expect(resolveEffectiveCeiling(item, rules, 'tier-1')).toBe(20);
  });

  it('requires ALL of a compound rule\'s scopes to match, not just one', () => {
    // A rule scoped to BOTH a specific product and a specific tier must not
    // apply to that product for every tier, nor to that tier for every
    // product — both conditions are requirements, not independent
    // alternatives. This is the exact compound-scope bug: a "product P1 +
    // GOLD tier" rule used to also cap every other product bought by a GOLD
    // customer, and P1 bought by every other tier.
    const compoundRule: DiscountRuleInput = {
      productId: 'prod-1',
      categoryId: null,
      customerTierId: 'tier-gold',
      maxDiscount: 5,
      active: true,
    };

    // Same product, different (non-matching) tier -> compound rule must NOT apply.
    expect(resolveEffectiveCeiling(item, [compoundRule], 'tier-silver')).toBe(0);

    // Same tier, different (non-matching) product -> compound rule must NOT apply.
    const otherProductItem: QuotationItemInput = { ...item, productId: 'prod-2' };
    expect(resolveEffectiveCeiling(otherProductItem, [compoundRule], 'tier-gold')).toBe(0);

    // Both scopes match -> compound rule DOES apply.
    expect(resolveEffectiveCeiling(item, [compoundRule], 'tier-gold')).toBe(5);
  });

  it('breaks a tie between equally-specific rules using priority, then the strictest ceiling', () => {
    const lowerPriority: DiscountRuleInput = {
      productId: 'prod-1',
      categoryId: null,
      customerTierId: null,
      maxDiscount: 15,
      priority: 1,
      active: true,
    };
    const higherPriority: DiscountRuleInput = {
      productId: 'prod-1',
      categoryId: null,
      customerTierId: null,
      maxDiscount: 25,
      priority: 5,
      active: true,
    };

    expect(resolveEffectiveCeiling(item, [lowerPriority, higherPriority], 'tier-1')).toBe(25);

    // Equal priority (or both omitted, defaulting to 0) -> the strictest wins.
    const tiedA: DiscountRuleInput = { ...lowerPriority, maxDiscount: 30, priority: 1 };
    const tiedB: DiscountRuleInput = { ...higherPriority, maxDiscount: 10, priority: 1 };
    expect(resolveEffectiveCeiling(item, [tiedA, tiedB], 'tier-1')).toBe(10);
  });

  it('ignores inactive rules', () => {
    const rules: DiscountRuleInput[] = [
      { productId: null, categoryId: 'cat-1', customerTierId: null, maxDiscount: 5, active: false },
    ];

    expect(resolveEffectiveCeiling(item, rules, 'tier-1')).toBe(0);
  });

  it('applies a fully-global rule (no scope) to any item', () => {
    const rules: DiscountRuleInput[] = [
      { productId: null, categoryId: null, customerTierId: null, maxDiscount: 12, active: true },
    ];

    expect(resolveEffectiveCeiling(item, rules, 'tier-1')).toBe(12);
  });
});
