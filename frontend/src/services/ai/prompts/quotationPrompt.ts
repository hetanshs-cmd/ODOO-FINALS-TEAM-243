import { QuotationAIContext } from '../types';

/**
 * Builds a structured, minimized context string for Quotation Copilot.
 * Ensures data minimization: ignores passwords, session tokens, internal auth details.
 */
export function buildQuotationPrompt(context: QuotationAIContext, task: 'summarize' | 'explain_risk' | 'suggest_improvements'): string {
  const { quotation, customerTier, customerName, lines, blendedRiskLevel, blendedRiskScore, approvalRequired, requiredApprovers, marginPercent, grandTotal, upsellOpportunities } = context;

  const linesSummary = lines.map((l) => ({
    product: l.productName,
    category: l.category,
    qty: l.quantity,
    unitPrice: l.unitPrice,
    discountPercent: l.discountPercent,
    allowedLimit: l.categoryLimitPercent,
    overBy: l.overBy,
    isSubscription: l.isSubscription,
    marginPercent: l.marginPercent,
  }));

  const payload = {
    task,
    quotationCode: quotation.code,
    customerName,
    customerTier,
    grandTotal,
    blendedRiskLevel,
    blendedRiskScore,
    marginPercent: `${marginPercent.toFixed(1)}%`,
    approvalRequired,
    requiredApprovers,
    orderLinesCount: lines.length,
    lines: linesSummary,
    upsellOpportunitiesCount: upsellOpportunities?.length || 0,
    currentStage: quotation.stage,
  };

  return JSON.stringify(payload, null, 2);
}
