/**
 * DealFlow360 — Hybrid Billing, Subscription & Proration Engine
 * Keeps one-time hardware/services and recurring subscriptions strictly separate.
 * Calculates mathematical proration, cancellation adjustments, and fulfillment-reconciled invoicing.
 */

import {
  Quotation,
  QuotationLine,
  BillingRecord,
  BillingScheduleEntry,
  ProrationResult,
  Subscription,
  SubscriptionBillingConfig,
  WarehouseSplitResult,
  HybridOrderLine,
  FirstInvoiceSummary,
  Invoice,
  InvoiceLine,
  CreditNote,
  DeliveryReconciliationItem,
  DeliveryReconciliationSummary,
} from '../../types';

/**
 * Separates one-time lines from recurring subscription lines
 * and builds a comprehensive hybrid billing structure.
 */
export function buildBillingRecord(quotation: Quotation): BillingRecord {
  const oneTimeLines: QuotationLine[] = [];
  const recurringLines: QuotationLine[] = [];

  for (const line of quotation.lines) {
    if (line.isSubscription || line.category === 'Subscription') {
      recurringLines.push(line);
    } else {
      oneTimeLines.push(line);
    }
  }

  const billingSchedule: BillingScheduleEntry[] = [];
  const now = new Date();

  // One-time upfront initial invoice schedule
  const oneTimeSubtotal = oneTimeLines.reduce((acc, l) => acc + (l.revenue ?? l.lineTotal), 0);
  if (oneTimeSubtotal > 0) {
    billingSchedule.push({
      id: `SCHED-INIT-${quotation.id}`,
      quotationId: quotation.id,
      billingDate: now.toISOString().split('T')[0],
      amount: Number(oneTimeSubtotal.toFixed(2)),
      status: quotation.stage === 'Completed' ? 'Paid' : 'Due',
      type: 'initial',
      description: 'One-time Hardware & Professional Services Deployment',
    });
  }

  // Recurring subscription schedules
  for (const subLine of recurringLines) {
    const cycle = subLine.recurringCycle || 'monthly';
    const recurringAmount = subLine.revenue ?? subLine.lineTotal;

    // Generate next 3 upcoming cycle entries
    for (let i = 1; i <= 3; i++) {
      const billDate = new Date(now);
      if (cycle === 'yearly') {
        billDate.setFullYear(billDate.getFullYear() + i);
      } else if (cycle === 'quarterly') {
        billDate.setMonth(billDate.getMonth() + i * 3);
      } else {
        billDate.setMonth(billDate.getMonth() + i);
      }

      billingSchedule.push({
        id: `SCHED-SUB-${subLine.id}-${i}`,
        quotationId: quotation.id,
        billingDate: billDate.toISOString().split('T')[0],
        amount: Number(recurringAmount.toFixed(2)),
        status: 'Upcoming',
        type: 'recurring',
        description: `Recurring ${subLine.productName || 'Care Plan'} (${cycle})`,
      });
    }
  }

  return {
    quotationId: quotation.id,
    oneTimeLines,
    recurringLines,
    billingSchedule,
  };
}

/**
 * Reconciles quotation lines with warehouse fulfillment state.
 * Physical hardware only becomes invoice-eligible when fulfilled/shipped.
 * Services & Software are immediately invoice-eligible.
 * Subscriptions are separated into recurring charges.
 */
export function getHybridBillingSummary(
  quotationOrLines: Quotation | QuotationLine[],
  splitResult?: WarehouseSplitResult | null
): FirstInvoiceSummary {
  const isQuotation = !Array.isArray(quotationOrLines);
  const quotationId = isQuotation ? (quotationOrLines as Quotation).id : 'QUOTE-GEN';
  const stage = isQuotation ? (quotationOrLines as Quotation).stage : 'Approved';
  const lines = isQuotation ? (quotationOrLines as Quotation).lines : (quotationOrLines as QuotationLine[]);

  const hybridLines: HybridOrderLine[] = [];
  let eligibleOneTimeSubtotal = 0;
  let pendingOneTimeSubtotal = 0;
  let recurringInitialCharge = 0;

  for (const line of lines) {
    const isSub = Boolean(line.isSubscription || line.category === 'Subscription');
    const isHardware = line.category === 'Hardware';

    let fulfilledQty = line.quantity;
    let pendingQty = 0;
    let status: HybridOrderLine['fulfillmentStatus'] = 'Not Applicable';

    if (isHardware) {
      if (splitResult && splitResult.allocations && splitResult.allocations.length > 0) {
        // Calculate shipped/allocated vs backordered from split
        const lineAllocations = splitResult.allocations.filter(
          (a) => a.productId === line.productId || (!a.productId && splitResult.allocations.length === 1)
        );

        if (lineAllocations.length > 0) {
          fulfilledQty = lineAllocations.reduce((sum, a) => sum + (a.quantityFulfilled ?? a.quantity ?? 0), 0);
          pendingQty = Math.max(0, line.quantity - fulfilledQty);
        } else if (splitResult.backorderedLines && splitResult.backorderedLines.some((b) => b.productId === line.productId)) {
          const backorder = splitResult.backorderedLines.find((b) => b.productId === line.productId);
          pendingQty = backorder?.backordered ?? backorder?.quantity ?? line.quantity;
          fulfilledQty = Math.max(0, line.quantity - pendingQty);
        }
      } else if (stage === 'Draft' || stage === 'Pending Approval') {
        fulfilledQty = 0;
        pendingQty = line.quantity;
      }

      if (fulfilledQty >= line.quantity) {
        status = 'Fulfilled';
      } else if (fulfilledQty > 0) {
        status = 'Partially Shipped';
      } else {
        status = 'Awaiting Shipment';
      }
    }

    const unitPrice = line.unitPrice ?? (line.baseUnitPrice || 0);
    const lineTotal = line.lineTotal ?? (unitPrice * line.quantity);
    let invoiceEligible = 0;

    if (isSub) {
      recurringInitialCharge += lineTotal;
      invoiceEligible = lineTotal;
    } else if (isHardware) {
      invoiceEligible = Number((fulfilledQty * unitPrice).toFixed(2));
      eligibleOneTimeSubtotal += invoiceEligible;
      pendingOneTimeSubtotal += Number((pendingQty * unitPrice).toFixed(2));
    } else {
      // Services or Software
      invoiceEligible = lineTotal;
      eligibleOneTimeSubtotal += invoiceEligible;
      status = 'Not Applicable';
    }

    const deferred = Number((pendingQty * unitPrice).toFixed(2));

    hybridLines.push({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      category: (line.category as any) || (isSub ? 'Subscription' : 'Hardware'),
      quantityOrdered: line.quantity,
      quantityFulfilled: fulfilledQty,
      quantityPending: pendingQty,
      unitPrice,
      lineTotal,
      invoiceEligibleAmount: invoiceEligible,
      isSubscription: isSub,
      recurringCycle: line.recurringCycle,
      fulfillmentStatus: status,
      quantity: line.quantity,
      backorderQuantity: pendingQty,
      invoicableAmount: invoiceEligible,
      deferredAmount: deferred,
      isFullyFulfilled: fulfilledQty >= line.quantity,
      isPartiallyFulfilled: fulfilledQty > 0 && fulfilledQty < line.quantity,
    });
  }

  const firstInvoiceEligibleTotal = Number((eligibleOneTimeSubtotal + recurringInitialCharge).toFixed(2));
  const physicalLines = hybridLines.filter((l) => l.category === 'Hardware');
  const serviceLines = hybridLines.filter((l) => l.category === 'Services' || l.category === 'Software');
  const recurringLines = hybridLines.filter((l) => l.isSubscription || l.category === 'Subscription');

  const physicalTotal = physicalLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const servicesTotal = serviceLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const recurringMRR = recurringLines.reduce((sum, l) => {
    return sum + (l.recurringCycle === 'yearly' ? l.lineTotal / 12 : l.lineTotal);
  }, 0);

  return {
    quotationId,
    eligibleOneTimeSubtotal: Number(eligibleOneTimeSubtotal.toFixed(2)),
    pendingOneTimeSubtotal: Number(pendingOneTimeSubtotal.toFixed(2)),
    recurringInitialCharge: Number(recurringInitialCharge.toFixed(2)),
    prorationAdjustment: 0,
    firstInvoiceEligibleTotal,
    lines: hybridLines,
    hasPendingPhysicalItems: pendingOneTimeSubtotal > 0,
    physicalTotal,
    physicalLines,
    servicesTotal,
    serviceLines,
    immediatelyInvoicableTotal: Number((eligibleOneTimeSubtotal + recurringInitialCharge).toFixed(2)),
    recurringMRR,
    recurringLines,
  };
}

/**
 * Core Function: Compute Proration
 *
 * Supports mid-cycle quantity, seat, or tier changes without hardcoded values.
 * Reads configured proration rule ('daily_linear', 'full_month', 'none').
 */
export function calculateProration(options: {
  previousAmount?: number;
  previousRecurringAmount?: number;
  previousPlanName?: string;
  previousQuantity?: number;
  newAmount?: number;
  newRecurringAmount?: number;
  newPlanName?: string;
  newQuantity?: number;
  remainingDays?: number;
  totalDays?: number;
  totalDaysInPeriod?: number;
  rule?: SubscriptionBillingConfig['prorationRule'];
  effectiveDate?: string;
  periodStart?: string;
  periodEnd?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  cycle?: 'monthly' | 'quarterly' | 'yearly';
}): ProrationResult {
  const previousAmount = options.previousAmount ?? options.previousRecurringAmount ?? 0;
  const newAmount = options.newAmount ?? options.newRecurringAmount ?? 0;
  const rule = options.rule || 'daily_linear';
  const effectiveDate = options.effectiveDate || new Date().toISOString().split('T')[0];
  const periodStart = options.periodStart || options.periodStartDate || '2026-09-01';
  const periodEnd = options.periodEnd || options.periodEndDate || '2026-10-01';

  let totalDays = options.totalDays ?? options.totalDaysInPeriod;
  let remainingDays = options.remainingDays;

  if (totalDays === undefined || remainingDays === undefined) {
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);
    const effDate = new Date(effectiveDate);
    const diffMs = Math.max(86400000, pEnd.getTime() - pStart.getTime());
    totalDays = Math.max(1, Math.round(diffMs / (1000 * 3600 * 24)));
    const remainMs = Math.max(0, pEnd.getTime() - effDate.getTime());
    remainingDays = Math.min(totalDays, Math.round(remainMs / (1000 * 3600 * 24)));
  }

  if (rule === 'none' || totalDays <= 0) {
    return {
      previousAmount,
      newAmount,
      remainingDays: 0,
      totalDays: Math.max(1, totalDays),
      totalDaysInPeriod: Math.max(1, totalDays),
      proratedCharge: newAmount,
      creditAmount: 0,
      netAdjustment: newAmount,
      effectiveDate,
      periodStart,
      periodEnd,
      ruleApplied: 'No Proration',
      description: 'No proration configured. New plan billed at full rate with zero credit for prior period.',
      explanation: 'No proration configured. New plan billed at full rate with zero credit for prior period.',
    };
  }

  if (rule === 'full_month') {
    const net = Number((newAmount - previousAmount).toFixed(2));
    return {
      previousAmount,
      newAmount,
      remainingDays,
      totalDays,
      totalDaysInPeriod: totalDays,
      proratedCharge: newAmount,
      creditAmount: previousAmount,
      netAdjustment: net,
      effectiveDate,
      periodStart,
      periodEnd,
      ruleApplied: 'Full Period Adjustment',
      description: 'Full period rate adjustment applied regardless of change effective date.',
      explanation: 'Full period rate adjustment applied regardless of change effective date.',
    };
  }

  // Standard 'daily_linear'
  const fraction = Math.min(1, Math.max(0, remainingDays / totalDays));
  const creditAmount = Number((previousAmount * fraction).toFixed(2));
  const proratedCharge = Number((newAmount * fraction).toFixed(2));
  const netAdjustment = Number((proratedCharge - creditAmount).toFixed(2));

  const explanation = `Daily linear proration applied for ${remainingDays} unused days of ${totalDays}-day billing period (${(fraction * 100).toFixed(1)}%). Unused credit on previous terms: -$${creditAmount.toFixed(2)}. Prorated charge on updated terms: +$${proratedCharge.toFixed(2)}. Net immediate adjustment: ${netAdjustment >= 0 ? '+' : ''}$${netAdjustment.toFixed(2)}.`;

  return {
    previousAmount,
    newAmount,
    remainingDays,
    totalDays,
    totalDaysInPeriod: totalDays,
    proratedCharge,
    creditAmount,
    netAdjustment,
    effectiveDate,
    periodStart,
    periodEnd,
    ruleApplied: 'Daily linear proration with credit on downgrade',
    description: explanation,
    explanation,
  };
}

/**
 * Backward compatibility alias for computeProration
 */
export function computeProration(
  previousAmount: number,
  newAmount: number,
  remainingDays: number,
  totalDays: number,
  rule?: SubscriptionBillingConfig['prorationRule']
): ProrationResult {
  return calculateProration({
    previousAmount,
    newAmount,
    remainingDays,
    totalDays,
    rule,
  });
}

/**
 * Core Function: Compute Cancellation Adjustment / Refund
 *
 * Calculates unused credit when a subscription is cancelled mid-cycle.
 * Reads configured cancellation policy ('prorated_credit', 'full_credit', 'no_refund').
 */
export function calculateCancellationRefund(options: {
  planAmount?: number;
  recurringAmount?: number;
  usedDays?: number;
  totalDays?: number;
  rule?: SubscriptionBillingConfig['cancellationRefundRule'];
  policy?: SubscriptionBillingConfig['cancellationRefundRule'];
  effectiveDate?: string;
  cancellationDate?: string;
  periodStart?: string;
  periodStartDate?: string;
  periodEnd?: string;
  periodEndDate?: string;
}): {
  usedAmount: number;
  creditAmount: number;
  unusedDays: number;
  totalDays: number;
  ruleApplied: string;
  policyApplied: string;
  description: string;
} {
  const planAmount = options.planAmount ?? options.recurringAmount ?? 0;
  const rule = options.policy || options.rule || 'prorated_credit';
  const effectiveDate = options.cancellationDate || options.effectiveDate || new Date().toISOString().split('T')[0];
  const periodStart = options.periodStartDate || options.periodStart || '2026-09-01';
  const periodEnd = options.periodEndDate || options.periodEnd || '2026-10-01';

  let totalDays = options.totalDays;
  let usedDays = options.usedDays;

  if (totalDays === undefined || usedDays === undefined) {
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);
    const effDate = new Date(effectiveDate);
    const diffMs = Math.max(86400000, pEnd.getTime() - pStart.getTime());
    totalDays = Math.max(1, Math.round(diffMs / (1000 * 3600 * 24)));
    const usedMs = Math.max(0, effDate.getTime() - pStart.getTime());
    usedDays = Math.min(totalDays, Math.round(usedMs / (1000 * 3600 * 24)));
  }

  const safeTotalDays = Math.max(1, totalDays);
  const unusedDays = Math.max(0, safeTotalDays - usedDays);

  if (rule === 'no_refund') {
    return {
      usedAmount: planAmount,
      creditAmount: 0,
      unusedDays,
      totalDays: safeTotalDays,
      ruleApplied: 'No Refund Policy',
      policyApplied: 'No Refund Policy',
      description: 'Subscription cancelled. Per active policy, no credit note or refund is issued for remaining days.',
    };
  }

  if (rule === 'full_credit') {
    return {
      usedAmount: 0,
      creditAmount: planAmount,
      unusedDays,
      totalDays: safeTotalDays,
      ruleApplied: 'Full Period Credit',
      policyApplied: 'Full Period Credit',
      description: `Subscription cancelled. Full billing period credit of $${planAmount.toLocaleString()} generated.`,
    };
  }

  // Standard 'prorated_credit'
  const ratio = unusedDays / safeTotalDays;
  const creditAmount = Number((planAmount * ratio).toFixed(2));
  const usedAmount = Number((planAmount - creditAmount).toFixed(2));

  return {
    usedAmount,
    creditAmount,
    unusedDays,
    totalDays: safeTotalDays,
    ruleApplied: 'Daily Linear Prorated Credit Note',
    policyApplied: 'Daily Linear Prorated Credit Note',
    description: `Subscription cancelled with ${unusedDays} of ${safeTotalDays} days remaining (effective ${effectiveDate || 'today'}). Generated credit adjustment of $${creditAmount.toFixed(2)}.`,
  };
}

/**
 * Backward compatibility alias for computeCancellationAdjustment
 */
export function computeCancellationAdjustment(
  planAmount: number,
  usedDays: number,
  totalDays: number,
  rule?: SubscriptionBillingConfig['cancellationRefundRule']
) {
  return calculateCancellationRefund({
    planAmount,
    usedDays,
    totalDays,
    rule,
  });
}

/**
 * Generates an upcoming billing schedule for a given subscription.
 * If the subscription is cancelled, future entries are marked 'Cancelled'.
 */
export function generateBillingSchedule(
  input:
    | Subscription
    | {
        subscriptionId: string;
        startDate: string;
        recurringAmount: number;
        cycle?: 'monthly' | 'quarterly' | 'yearly';
        count?: number;
      },
  countOverride?: number
): BillingScheduleEntry[] {
  const schedule: BillingScheduleEntry[] = [];
  const isDirectSub = 'status' in input;

  const subscriptionId = isDirectSub ? input.id : input.subscriptionId;
  const subCode = isDirectSub ? input.code : subscriptionId;
  const quotationId = isDirectSub ? input.quotationId : undefined;
  const baseDateStr = isDirectSub ? input.nextBillDate || input.startDate : input.startDate;
  const baseDate = new Date(baseDateStr || new Date());
  const cycle = (isDirectSub ? input.cycle : input.cycle) || 'monthly';
  const amount = isDirectSub ? input.amount ?? 0 : input.recurringAmount;
  const isCancelled = isDirectSub && input.status === 'Cancelled';
  const planName = isDirectSub ? input.planName : 'Subscription';
  const count = countOverride ?? (isDirectSub ? 4 : input.count ?? 4);

  for (let i = 0; i < count; i++) {
    const billDate = new Date(baseDate);
    const periodStartDate = new Date(billDate);
    const periodEndDate = new Date(billDate);

    if (cycle === 'yearly') {
      periodStartDate.setFullYear(periodStartDate.getFullYear() + i);
      periodEndDate.setFullYear(periodEndDate.getFullYear() + i + 1);
      billDate.setFullYear(billDate.getFullYear() + i);
    } else if (cycle === 'quarterly') {
      periodStartDate.setMonth(periodStartDate.getMonth() + i * 3);
      periodEndDate.setMonth(periodEndDate.getMonth() + (i + 1) * 3);
      billDate.setMonth(billDate.getMonth() + i * 3);
    } else {
      periodStartDate.setMonth(periodStartDate.getMonth() + i);
      periodEndDate.setMonth(periodEndDate.getMonth() + i + 1);
      billDate.setMonth(billDate.getMonth() + i);
    }

    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + 14);

    const dateStr = billDate.toISOString().split('T')[0];
    const status: BillingScheduleEntry['status'] = isCancelled
      ? 'Cancelled'
      : i === 0
      ? 'Due'
      : 'Upcoming';

    schedule.push({
      id: `SCHED-${subCode || subscriptionId}-${i + 1}`,
      subscriptionId,
      quotationId,
      billingDate: dateStr,
      amount: Number(amount.toFixed(2)),
      status,
      type: 'recurring',
      cycleNumber: i + 1,
      periodStartDate: periodStartDate.toISOString().split('T')[0],
      periodEndDate: periodEndDate.toISOString().split('T')[0],
      invoiceDate: dateStr,
      dueDate: dueDate.toISOString().split('T')[0],
      description: isCancelled
        ? `Recurring cycle cancelled (${planName || 'Plan'})`
        : `Scheduled recurring charge for ${planName || 'Plan'} (${cycle})`,
    });
  }

  return schedule;
}

/**
 * ============================================================================
 * DELIVERY → INVOICING → PAYMENT RECONCILIATION ENGINE
 * Rule: "NOTHING BILLS BEFORE IT SHIPS"
 * For physical goods: invoiceable quantity <= fulfilled/shipped quantity.
 * ============================================================================
 */

/**
 * Calculates strict billable quantity based on product fulfillment status.
 * Non-stock services are immediately invoice-eligible upon order confirmation.
 * Physical hardware requires verified shipment/allocation before it can be billed.
 */
export function getInvoiceableQuantity(
  orderedQty: number,
  shippedQty: number,
  isPhysical: boolean
): number {
  if (!isPhysical) {
    return Math.max(0, orderedQty);
  }
  return Math.max(0, Math.min(orderedQty, shippedQty));
}

/**
 * Reconciles quotation lines, warehouse fulfillment/dispatch state, and invoiced quantities.
 * Generates an authoritative reconciliation summary detailing shipped, invoiced, and pending backorders.
 */
export function reconcileDeliveryAndBilling(options: {
  quotation: Quotation;
  fulfillmentSplit?: WarehouseSplitResult | null;
  invoice?: Invoice | null;
  allInvoices?: Invoice[];
}): DeliveryReconciliationSummary {
  const { quotation, fulfillmentSplit, invoice, allInvoices = [] } = options;
  const items: DeliveryReconciliationItem[] = [];

  let totalOrderedPhysicalUnits = 0;
  let totalShippedPhysicalUnits = 0;
  let totalInvoicedPhysicalUnits = 0;
  let totalPendingPhysicalUnits = 0;
  let hasInconsistencies = false;

  for (const line of quotation.lines) {
    const isPhysical = line.category === 'Hardware';
    const isSubscription = Boolean(line.isSubscription || line.category === 'Subscription');
    const unitPrice = line.unitPrice ?? line.baseUnitPrice;

    // 1. Determine fulfilled/shipped quantity from fulfillment allocations
    let shippedQty = 0;
    let pendingQty = 0;

    if (isPhysical) {
      totalOrderedPhysicalUnits += line.quantity;

      if (fulfillmentSplit) {
        const allocations = fulfillmentSplit.allocations || [];
        const lineAllocations = allocations.filter((a) => a.productId === line.productId);
        shippedQty = lineAllocations.reduce((sum, a) => sum + (a.quantityFulfilled ?? a.quantity ?? 0), 0);

        const backorders = fulfillmentSplit.backorderedLines || [];
        const backorder = backorders.find((b) => b.productId === line.productId);
        if (backorder) {
          pendingQty = backorder.backordered ?? backorder.quantity ?? Math.max(0, line.quantity - shippedQty);
        } else {
          pendingQty = Math.max(0, line.quantity - shippedQty);
        }
      } else if (quotation.stage === 'Draft' || quotation.stage === 'Pending Approval') {
        shippedQty = 0;
        pendingQty = line.quantity;
      } else {
        // Default approved/confirmed deal without split: assume ready or full
        shippedQty = line.quantity;
        pendingQty = 0;
      }

      totalShippedPhysicalUnits += shippedQty;
      totalPendingPhysicalUnits += pendingQty;
    } else {
      // Non-physical (Services or Subscription)
      shippedQty = line.quantity;
      pendingQty = 0;
    }

    // 2. Determine invoiced quantity from invoice lines
    let invoicedQty = 0;
    if (invoice && invoice.lines) {
      const matchingLine = invoice.lines.find(
        (il) => il.productId === line.productId || il.description.includes(line.productName)
      );
      if (matchingLine) {
        invoicedQty = matchingLine.billedQty ?? matchingLine.quantity ?? 0;
      }
    } else if (allInvoices.length > 0) {
      // Aggregate from all related invoices for this quote
      for (const inv of allInvoices) {
        if (inv.quotationId === quotation.id && inv.lines) {
          const matching = inv.lines.find(
            (il) => il.productId === line.productId || il.description.includes(line.productName)
          );
          if (matching) {
            invoicedQty += matching.billedQty ?? matching.quantity ?? 0;
          }
        }
      }
    }

    if (isPhysical) {
      totalInvoicedPhysicalUnits += invoicedQty;
    }

    // 3. Reconcile remaining quantities
    const remainingToShipQty = Math.max(0, line.quantity - shippedQty);
    const invoiceableLimit = getInvoiceableQuantity(line.quantity, shippedQty, isPhysical);
    const remainingToInvoiceQty = Math.max(0, invoiceableLimit - invoicedQty);

    // 4. Inconsistency Check (Physical: invoiced MUST NOT exceed shipped)
    const isInconsistent = isPhysical && invoicedQty > shippedQty;
    if (isInconsistent) {
      hasInconsistencies = true;
    }

    // 5. Fulfillment status classification
    let status: DeliveryReconciliationItem['fulfillmentStatus'];
    if (!isPhysical) {
      status = 'Not Applicable';
    } else if (shippedQty >= line.quantity) {
      status = 'Fulfilled';
    } else if (shippedQty > 0) {
      status = 'Partially Shipped';
    } else {
      status = 'Awaiting Shipment';
    }

    // 6. Explainability explanation
    let explanation = '';
    if (isSubscription) {
      explanation = 'Recurring SaaS subscription. Invoiced on recurring schedule independently of physical shipment.';
    } else if (!isPhysical) {
      explanation = 'Non-stock commercial service. Immediately billable upon customer agreement confirmation.';
    } else if (isInconsistent) {
      explanation = `CRITICAL RULE VIOLATION: Invoiced quantity (${invoicedQty}) exceeds shipped units (${shippedQty}). Nothing bills before it ships!`;
    } else if (remainingToShipQty > 0) {
      explanation = `${remainingToShipQty} units are not yet invoiceable. Reason: They remain backordered and have not shipped from distribution center.`;
    } else {
      explanation = `All ${line.quantity} units fully shipped and eligible for invoicing.`;
    }

    const invoicableAmount = Number((Math.min(shippedQty, line.quantity) * unitPrice).toFixed(2));
    const deferredAmount = Number((remainingToShipQty * unitPrice).toFixed(2));

    items.push({
      productId: line.productId,
      productName: line.productName,
      category: line.category,
      orderedQty: line.quantity,
      shippedQty,
      invoicedQty,
      remainingToShipQty,
      remainingToInvoiceQty,
      unitPrice,
      invoicableAmount,
      deferredAmount,
      fulfillmentStatus: status,
      isInconsistent,
      inconsistencyError: isInconsistent
        ? `Overbilling anomaly: ${invoicedQty} units invoiced but only ${shippedQty} verified shipped.`
        : undefined,
      explanation,
    });
  }

  return {
    quotationId: quotation.id,
    quotationCode: quotation.code,
    hasPhysicalInventory: totalOrderedPhysicalUnits > 0,
    hasPendingShipments: totalPendingPhysicalUnits > 0,
    hasInconsistencies,
    totalOrderedPhysicalUnits,
    totalShippedPhysicalUnits,
    totalInvoicedPhysicalUnits,
    totalPendingPhysicalUnits,
    items,
  };
}

/**
 * Calculates complete accounting totals for an invoice.
 * Supports Subtotal, Discount, Tax, Proration adjustments, Credit Notes, and Balance Due.
 */
export function calculateInvoiceTotals(params: {
  lines?: InvoiceLine[];
  subtotal?: number;
  discountAmount?: number;
  tax?: number;
  taxRate?: number;
  prorationAdjustment?: number;
  creditAmount?: number;
  paidAmount?: number;
}): {
  subtotal: number;
  discountAmount: number;
  tax: number;
  prorationAdjustment: number;
  creditAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
} {
  const {
    lines = [],
    discountAmount = 0,
    prorationAdjustment = 0,
    creditAmount = 0,
    paidAmount = 0,
  } = params;

  let computedSubtotal = params.subtotal ?? 0;
  if (computedSubtotal === 0 && lines.length > 0) {
    computedSubtotal = lines.reduce((sum, l) => sum + (l.amount ?? (l.quantity * l.unitPrice)), 0);
  }

  let computedTax = params.tax ?? 0;
  if (computedTax === 0 && params.taxRate && params.taxRate > 0) {
    computedTax = Number(((computedSubtotal - discountAmount) * params.taxRate).toFixed(2));
  }

  const rawTotal = computedSubtotal - discountAmount + computedTax + prorationAdjustment - creditAmount;
  const total = Number(rawTotal.toFixed(2));
  const balanceDue = Number(Math.max(0, total - paidAmount).toFixed(2));

  return {
    subtotal: Number(computedSubtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    tax: Number(computedTax.toFixed(2)),
    prorationAdjustment: Number(prorationAdjustment.toFixed(2)),
    creditAmount: Number(creditAmount.toFixed(2)),
    total,
    paidAmount: Number(paidAmount.toFixed(2)),
    balanceDue,
  };
}

/**
 * Applies a credit note to an invoice and updates net balance due.
 */
export function applyCredits(
  invoiceTotal: number,
  creditNote: CreditNote
): {
  originalTotal: number;
  creditApplied: number;
  adjustedTotal: number;
  balanceDue: number;
} {
  const creditApplied = Math.min(invoiceTotal, Math.abs(creditNote.amount));
  const adjustedTotal = Number((invoiceTotal - creditApplied).toFixed(2));
  return {
    originalTotal: invoiceTotal,
    creditApplied,
    adjustedTotal,
    balanceDue: Math.max(0, adjustedTotal),
  };
}
