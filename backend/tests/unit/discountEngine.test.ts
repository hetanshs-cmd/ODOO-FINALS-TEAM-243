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

  it('picks the strictest (minimum) ceiling when multiple scoped rules match', () => {
    const rules: DiscountRuleInput[] = [
      { productId: null, categoryId: 'cat-1', customerTierId: null, maxDiscount: 20, active: true },
      { productId: null, categoryId: null, customerTierId: 'tier-1', maxDiscount: 8, active: true },
    ];

    expect(resolveEffectiveCeiling(item, rules, 'tier-1')).toBe(8);
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
