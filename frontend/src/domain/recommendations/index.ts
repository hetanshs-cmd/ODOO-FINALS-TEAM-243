/**
 * DealFlow360 — Upsell & Cross-Sell Recommendation Engine
 * Deterministic pairing rules with dynamic margin-delta calculation and dismissal tracking.
 */

import { Product, Quotation, UpsellSuggestion, UpsellRule } from '../../types';

export function getUpsellSuggestions(
  quotation: Quotation,
  products: Product[],
  dismissedProductIds: string[] = [],
  upsellRules?: UpsellRule[]
): UpsellSuggestion[] {
  const currentProductIds = new Set(quotation.lines.map((l) => l.productId));
  const dismissedSet = new Set(dismissedProductIds);

  // If dynamic configurable upsell rules are supplied, use them authoritatively
  if (upsellRules && upsellRules.length > 0) {
    const activeRules = upsellRules.filter((r) => r.active !== false);
    const suggestions: UpsellSuggestion[] = [];

    for (const rule of activeRules) {
      // Check if trigger product is present in quotation
      const hasTrigger = quotation.lines.some(
        (l) =>
          l.productId === rule.triggerProductId ||
          (rule.triggerProductName &&
            (l.productName || '').toLowerCase().includes(rule.triggerProductName.toLowerCase()))
      );

      if (
        hasTrigger &&
        !currentProductIds.has(rule.recommendedProductId) &&
        !dismissedSet.has(rule.recommendedProductId)
      ) {
        const matchedProduct = products.find(
          (p) =>
            p.id === rule.recommendedProductId ||
            (rule.recommendedProductName &&
              p.name.toLowerCase().includes(rule.recommendedProductName.toLowerCase()))
        );

        if (matchedProduct) {
          const basePrice = matchedProduct.price ?? matchedProduct.basePrice;
          const costBasis = matchedProduct.costBasisPercent ?? 60;
          const marginDelta = Number((basePrice * (1 - costBasis / 100)).toFixed(2));

          suggestions.push({
            id: `SUGG-${rule.id}`,
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            targetCategory: matchedProduct.category,
            reason: rule.reason,
            marginDelta,
            promotion: rule.promoted ?? false,
            isPromoted: rule.promoted ?? false,
            priority: rule.priority,
          });
        }
      }
    }

    return suggestions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.marginDelta - a.marginDelta;
    });
  }

  const hasProduct = (nameSubstring: string) =>
    quotation.lines.some((l) =>
      (l.productName || '').toLowerCase().includes(nameSubstring.toLowerCase())
    );

  const hasCategory = (cat: string) =>
    quotation.lines.some((l) => l.category === cat);

  const candidates: {
    productNameFilter: string;
    reason: string;
    priority: number;
    promotion?: boolean;
  }[] = [];

  const hasLaptop = hasProduct('laptop');
  const hasGateway = hasProduct('gateway') || hasProduct('iot');
  const hasHardware = hasCategory('Hardware');
  const hasService = hasCategory('Services');
  const hasSubscription = hasCategory('Subscription');

  // Deterministic rule hierarchy
  if (hasGateway) {
    candidates.push(
      {
        productNameFilter: '24/7 Mission-Critical SLA',
        reason: 'Often paired with Industrial IoT Gateway installations. Dedicated 24/7 technical lead and proactive monitoring.',
        priority: 1,
        promotion: true,
      },
      {
        productNameFilter: 'IoT Cloud Analytics Enterprise',
        reason: 'Real-time telemetry streaming and predictive fleet analytics for IoT Gateway deployments.',
        priority: 2,
        promotion: true,
      }
    );
  }

  if (hasLaptop) {
    candidates.push(
      {
        productNameFilter: 'Wireless Mouse',
        reason: 'Recommended accessory pairing with Laptop Pro 14 (94% customer attach rate).',
        priority: 1,
        promotion: true,
      },
      {
        productNameFilter: 'Docking Station',
        reason: 'Essential enterprise desktop expansion bundle for dual 4K monitors and power delivery.',
        priority: 2,
        promotion: false,
      },
      {
        productNameFilter: 'Extended Warranty',
        reason: 'Comprehensive 3-year hardware replacement SLA with next-business-day on-site dispatch.',
        priority: 3,
        promotion: false,
      }
    );
  }

  if (hasHardware && !hasService) {
    candidates.push({
      productNameFilter: 'Onsite Setup Service',
      reason: 'Turnkey hardware provisioning, firmware configuration, and network validation.',
      priority: 2,
      promotion: true,
    });
  }

  if (hasHardware && !hasSubscription) {
    candidates.push({
      productNameFilter: 'Care Plan 2yr',
      reason: 'Continuous predictive maintenance, firmware lifecycle patches, and prioritized 24/7 SLA.',
      priority: 1,
      promotion: true,
    });
  }

  const suggestions: UpsellSuggestion[] = [];

  for (const candidate of candidates) {
    const matchedProduct = products.find(
      (p) =>
        p.name.toLowerCase().includes(candidate.productNameFilter.toLowerCase()) &&
        !currentProductIds.has(p.id) &&
        !dismissedSet.has(p.id)
    );

    if (matchedProduct) {
      // Calculate realistic margin delta from product
      const basePrice = matchedProduct.price ?? matchedProduct.basePrice;
      const costBasis = matchedProduct.costBasisPercent ?? 60;
      const marginDelta = Number((basePrice * (1 - costBasis / 100)).toFixed(2));

      suggestions.push({
        id: `SUGG-${matchedProduct.id}`,
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        targetCategory: matchedProduct.category,
        reason: candidate.reason,
        marginDelta,
        promotion: candidate.promotion ?? false,
        isPromoted: candidate.promotion ?? false,
        priority: candidate.priority,
      });
    }
  }

  // Sort by priority ascending (1 is highest priority), then margin delta descending
  return suggestions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.marginDelta - a.marginDelta;
  });
}
