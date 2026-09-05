import { WorkspaceAIContext } from '../types';

export function buildWorkspacePrompt(context: WorkspaceAIContext, query: string): string {
  const pendingApprovals = context.quotations.filter(
    (q) => q.stage === 'PendingApproval' || q.stage === 'Pending Approval'
  ).map((q) => ({
    code: q.code,
    id: q.id,
    customer: q.customerName,
    total: q.grandTotal,
    approvers: q.requiredApprovers,
  }));

  const highRiskQuotes = context.quotations.filter(
    (q) => (q.blendedRiskValue || q.blendedRiskLevel) === 'HIGH' || (q.blendedRiskScore || 0) >= 70
  ).map((q) => ({
    code: q.code,
    id: q.id,
    customer: q.customerName,
    score: q.blendedRiskScore,
  }));

  const activeFlags = context.dealHealthFlags.filter((f) => !f.isResolved).map((f) => ({
    id: f.id,
    type: f.type,
    quotationId: f.quotationId,
    details: f.details || f.detail,
    severity: f.severity,
  }));

  return JSON.stringify({
    query,
    userRole: context.userRole,
    summaryStats: {
      totalQuotations: context.quotations.length,
      pendingApprovalsCount: pendingApprovals.length,
      highRiskCount: highRiskQuotes.length,
      activeFlagsCount: activeFlags.length,
    },
    pendingApprovals,
    highRiskQuotes,
    activeFlags,
  }, null, 2);
}
