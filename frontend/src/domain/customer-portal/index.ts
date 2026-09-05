/**
 * DealFlow360 — Customer Portal Data Restriction & Privacy Boundary
 * Sanitizes quotations to strictly exclude internal deal desk margins, risk scores,
 * cost bases, rep profitability, and approval chains.
 */

import { Quotation, QuotationLine, NegotiationRequest } from '../../types';

export interface CustomerVisibleLine {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  baseUnitPrice: number;
  discountPercent: number;
  lineTotal: number;
  isSubscription: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly';
  previousDiscountPercent?: number;
}

export interface CustomerVisibleQuotation {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  stage: string;
  customerFacingStatus: string;
  statusExplanation: string;
  isUnderReview: boolean;
  canNegotiate: boolean;
  canConfirm: boolean;
  isConfirmed: boolean;
  lines: CustomerVisibleLine[];
  oneTimeLines: CustomerVisibleLine[];
  recurringLines: CustomerVisibleLine[];
  subtotal: number;
  totalDiscount: number;
  tax: number;
  grandTotal: number;
  oneTimeSubtotal: number;
  recurringMonthlySubtotal: number;
  firstInvoiceEstimate: number;
  createdAt: string;
  updatedAt: string;
  repName?: string;
  notes?: string;
  validUntilDate: string;
  requestedDeliveryDate?: string;
  negotiationStatus?: string;
}

/**
 * Strips internal deal desk metrics and builds a secure, customer-facing model.
 * Enforces cross-customer authorization: returns null if the quotation belongs to another customer.
 */
export function getCustomerVisibleQuotation(
  quotation: Quotation,
  currentCustomerId?: string
): CustomerVisibleQuotation | null {
  // Security check: Customer can only access their own quotation
  if (currentCustomerId && quotation.customerId !== currentCustomerId) {
    return null;
  }

  const isUnderReview =
    quotation.stage === 'Pending Approval' ||
    quotation.stage === 'PendingApproval' ||
    quotation.stage === 'Returned for Revision' ||
    quotation.stage === 'ReturnedForRevision' ||
    quotation.negotiationStatus === 'UnderReview' ||
    (quotation.stage === 'Negotiation' && quotation.negotiationStatus === 'Pending');

  const isConfirmed = quotation.stage === 'Confirmed';

  // Customer-facing status mapping
  let customerFacingStatus = 'Ready for Review';
  let statusExplanation = 'Please review the quotation terms below. You can request changes or confirm.';

  if (isConfirmed) {
    customerFacingStatus = 'Confirmed';
    statusExplanation = 'Quotation confirmed. Your order is being prepared for fulfillment.';
  } else if (isUnderReview) {
    customerFacingStatus = 'Under Negotiation';
    statusExplanation = 'Your requested commercial changes are currently being reviewed by our account team.';
  } else if (quotation.stage === 'Approved') {
    customerFacingStatus = 'Approved & Ready';
    statusExplanation = 'Commercial terms approved and ready for your confirmation.';
  } else if (quotation.stage === 'Sent') {
    customerFacingStatus = 'Ready for Review';
    statusExplanation = 'Review the proposal below. You can request changes or confirm the terms.';
  } else if (quotation.stage === 'Draft') {
    customerFacingStatus = 'Draft Proposal';
    statusExplanation = 'Preliminary commercial proposal in preparation.';
  }

  const canNegotiate = !isConfirmed && !isUnderReview;
  const canConfirm = !isConfirmed && !isUnderReview && (quotation.stage === 'Sent' || quotation.stage === 'Approved' || quotation.stage === 'Negotiation');

  // Sanitize line items: strip cost basis, margins, overBy, risk indicators
  const customerLines: CustomerVisibleLine[] = quotation.lines.map((l: QuotationLine) => ({
    id: l.id,
    productId: l.productId,
    productName: l.productName || 'Product item',
    category: l.category || 'Hardware',
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    baseUnitPrice: l.baseUnitPrice || l.unitPrice,
    discountPercent: l.discountPercent || 0,
    lineTotal: l.lineTotal,
    isSubscription: Boolean(l.isSubscription),
    recurringCycle: l.recurringCycle,
    previousDiscountPercent: (l as any).previousDiscountPercent,
  }));

  const oneTimeLines = customerLines.filter((l) => !l.isSubscription);
  const recurringLines = customerLines.filter((l) => l.isSubscription);

  const oneTimeSubtotal = Number(oneTimeLines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2));
  const recurringMonthlySubtotal = Number(
    recurringLines.reduce((sum, l) => {
      const mult = l.recurringCycle === 'yearly' ? 1 / 12 : l.recurringCycle === 'quarterly' ? 1 / 3 : 1;
      return sum + l.lineTotal * mult;
    }, 0).toFixed(2)
  );

  // First invoice estimate: One-time lines + first month subscription + tax
  const firstInvoiceEstimate = Number((oneTimeSubtotal + recurringMonthlySubtotal + quotation.tax).toFixed(2));

  // Expiration date: 30 days from creation or fixed demo date
  const validUntilDate = quotation.expirationDate || '18 Sep 2026';

  return {
    id: quotation.id,
    code: quotation.code,
    customerId: quotation.customerId,
    customerName: quotation.customerName || 'Customer',
    stage: quotation.stage,
    customerFacingStatus,
    statusExplanation,
    isUnderReview,
    canNegotiate,
    canConfirm,
    isConfirmed,
    lines: customerLines,
    oneTimeLines,
    recurringLines,
    subtotal: quotation.subtotal,
    totalDiscount: quotation.totalDiscount,
    tax: quotation.tax,
    grandTotal: quotation.grandTotal,
    oneTimeSubtotal,
    recurringMonthlySubtotal,
    firstInvoiceEstimate,
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    repName: quotation.repName || 'Sarah Chen',
    notes: quotation.notes,
    validUntilDate,
    requestedDeliveryDate: quotation.requestedDeliveryDate,
    negotiationStatus: quotation.negotiationStatus,
  };
}

/**
 * Filter negotiation messages and comments relevant to a specific quotation
 */
export function getNegotiationMessagesForQuotation(
  negotiations: NegotiationRequest[],
  quotationId: string
): NegotiationRequest[] {
  return negotiations.filter((n) => n.quotationId === quotationId);
}

/**
 * Get line-specific messages/questions
 */
export function getLineMessages(
  negotiations: NegotiationRequest[],
  quotationId: string,
  lineId: string
): NegotiationRequest[] {
  return negotiations.filter((n) => n.quotationId === quotationId && n.lineId === lineId);
}
