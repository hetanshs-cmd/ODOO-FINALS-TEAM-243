import { DealHealthAIContext, DealHealthNudgeContext } from '../types';

export function buildDealHealthPrompt(context: DealHealthAIContext): string {
  const flagsSummary = context.flags.map((f) => ({
    id: f.id,
    type: f.type,
    severity: f.severity,
    quotationId: f.quotationId,
    details: f.details || f.detail,
    metricValue: f.metricValue,
    threshold: f.threshold,
    recommendedAction: f.recommendedAction,
  }));

  return JSON.stringify({
    totalQuotations: context.totalQuotations,
    activeFlagsCount: context.flags.length,
    stalledCount: context.stalledCount,
    discountDeviationCount: context.discountDeviationCount,
    deliveryRiskCount: context.deliveryRiskCount,
    flags: flagsSummary,
  }, null, 2);
}

export function buildNudgePrompt(context: DealHealthNudgeContext): string {
  return JSON.stringify({
    quotationCode: context.quotationCode || context.flag.quotationId,
    repName: context.repName || 'Assigned Rep',
    customerName: context.customerName || 'Customer Account',
    anomalyType: context.flag.type,
    severity: context.flag.severity,
    issue: context.flag.details || context.flag.detail,
    metric: context.flag.metricValue,
  }, null, 2);
}
