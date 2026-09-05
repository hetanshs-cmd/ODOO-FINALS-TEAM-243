/**
 * DealFlow360 — Margin & Quotation Financial Engine
 * Pure deterministic calculations for line-level and quote-level revenue, cost, profit, and margins.
 */

import { Product, QuotationLine, Quotation } from '../../types';

export interface MarginDeltaResult {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  discountAmount: number;
}

/**
 * Core Function #4: Compute Margin Delta
 *
 * Computes revenue, cost, profit, and margin for a product given discount and quantity.
 * If no cost basis is provided on product, defaults to 60%.
 */
export function computeMarginDelta(
  product: { price?: number; basePrice?: number; costBasisPercent?: number },
  discountPercent: number,
  quantity: number
): MarginDeltaResult {
  const basePrice = product.price ?? product.basePrice ?? 0;
  const costBasisPercent = product.costBasisPercent ?? 60;

  // Single unit calculations
  const unitDiscountAmount = Number((basePrice * (discountPercent / 100)).toFixed(2));
  const discountedUnitPrice = Number((basePrice - unitDiscountAmount).toFixed(2));
  const unitCost = Number((basePrice * (costBasisPercent / 100)).toFixed(2));

  // Multi-unit totals
  const revenue = Number((discountedUnitPrice * quantity).toFixed(2));
  const cost = Number((unitCost * quantity).toFixed(2));
  const profit = Number((revenue - cost).toFixed(2));
  const discountAmount = Number((unitDiscountAmount * quantity).toFixed(2));
  const marginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

  return {
    revenue,
    cost,
    profit,
    marginPercent,
    discountAmount,
  };
}

export interface QuotationFinancialTotals {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  tax: number;
  grandTotal: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

/**
 * Core Function #5: Compute Quotation Totals
 *
 * Aggregates all quotation lines to produce deterministic quote totals.
 */
export function computeQuotationTotals(
  quotationOrLines: Quotation | QuotationLine[],
  defaultTaxPercent = 10
): QuotationFinancialTotals {
  const lines: QuotationLine[] = Array.isArray(quotationOrLines)
    ? quotationOrLines
    : quotationOrLines.lines || [];

  let subtotal = 0;
  let totalDiscount = 0;
  let revenue = 0;
  let cost = 0;

  for (const line of lines) {
    const baseUnit = line.baseUnitPrice ?? line.unitPrice ?? 0;
    const qty = line.quantity ?? 1;
    const lineSubtotal = baseUnit * qty;
    const discAmount = line.discountAmount ?? (baseUnit * ((line.discountPercent ?? 0) / 100) * qty);
    const lineRevenue = line.revenue ?? (lineSubtotal - discAmount);
    const lineCost = line.cost ?? (baseUnit * 0.6 * qty);

    subtotal += lineSubtotal;
    totalDiscount += discAmount;
    revenue += lineRevenue;
    cost += lineCost;
  }

  subtotal = Number(subtotal.toFixed(2));
  totalDiscount = Number(totalDiscount.toFixed(2));
  revenue = Number(revenue.toFixed(2));
  cost = Number(cost.toFixed(2));

  const taxableAmount = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));
  const tax = Number((taxableAmount * (defaultTaxPercent / 100)).toFixed(2));
  const grandTotal = Number((taxableAmount + tax).toFixed(2));
  const profit = Number((revenue - cost).toFixed(2));
  const marginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    tax,
    grandTotal,
    revenue,
    cost,
    profit,
    marginPercent,
  };
}
