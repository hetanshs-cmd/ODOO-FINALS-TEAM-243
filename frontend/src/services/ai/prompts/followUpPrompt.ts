import { FollowUpAIContext, NegotiationAIContext } from '../types';

/**
 * Builds customer follow-up prompt.
 * CRITICAL PRIVACY MANDATE (Section 44, Test J):
 * Customer-facing prompt builder MUST NOT contain internal margin %,
 * risk scores, approval thresholds, rep historical averages, or internal governance flags.
 */
export function buildFollowUpPrompt(context: FollowUpAIContext, customInstructions?: string): string {
  return JSON.stringify({
    audience: 'customer',
    quotationCode: context.quotationCode,
    customerName: context.customerName,
    repName: context.repName,
    commercialValue: `$${context.totalAmount.toLocaleString()}`,
    dealStage: context.stage,
    lastActivity: context.lastActivityAt || 'recently',
    instructions: customInstructions || 'Polite, professional executive check-in on quotation evaluation.',
  }, null, 2);
}

/**
 * Negotiation response prompt builder.
 * Ensures internal escalation reasoning is omitted from customer-visible text.
 */
export function buildNegotiationPrompt(context: NegotiationAIContext): string {
  return JSON.stringify({
    audience: context.isCustomerFacing ? 'customer' : 'internal_team',
    quotationCode: context.quotationCode,
    customerName: context.customerName,
    repName: context.repName || 'Sales Representative',
    requestedDiscount: context.requestedDiscount !== undefined ? `${context.requestedDiscount}%` : undefined,
    requestedDeliveryDate: context.requestedDeliveryDate,
    customerComment: context.customerComment,
  }, null, 2);
}
