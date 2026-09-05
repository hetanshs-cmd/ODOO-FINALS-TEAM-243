import { ApprovalAIContext } from '../types';

export function buildApprovalPrompt(context: ApprovalAIContext, task: 'explain' | 'draft_note'): string {
  const { quotation, customerName, customerTier, quoteTotalValue, marginPercent, approvalChain, currentActiveRole, flaggedLines, worstLineOverBy, auditReasons } = context;

  const payload = {
    task,
    quotationCode: quotation.code,
    customerName,
    customerTier,
    quoteTotalValue,
    marginPercent: `${marginPercent.toFixed(1)}%`,
    approvalChain,
    currentActiveRole,
    flaggedLinesCount: flaggedLines.length,
    flaggedLines,
    worstLineOverBy,
    governanceReasons: auditReasons,
  };

  return JSON.stringify(payload, null, 2);
}
