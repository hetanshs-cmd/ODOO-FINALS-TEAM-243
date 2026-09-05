/**
 * DealFlow360 — Approval Routing Governance Domain Interface
 * Pure contract definitions for multi-tier approval chains and audit workflows.
 */

import { ApprovalRole, Quotation } from '../../types';

export interface ApprovalChainRoutingResult {
  requiresApproval: boolean;
  chain: ApprovalRole[];
  triggerReason: string;
  nextRole?: ApprovalRole;
}

export interface ApprovalEngineContract {
  determineApprovalChain(quotation: Quotation): ApprovalChainRoutingResult;
}

export const approvalEngine: ApprovalEngineContract = {
  determineApprovalChain(quotation) {
    // Scaffold contract - structure contract without pre-empting feature prompt implementation
    const needsFinance = quotation.blendedRiskScore >= 65;
    const chain: ApprovalRole[] = needsFinance ? ['SalesManager', 'Finance'] : ['SalesManager'];
    return {
      requiresApproval: quotation.approvalRequired || quotation.blendedRiskScore > 30,
      chain,
      triggerReason: needsFinance
        ? 'High blended risk score escalated to Finance approval.'
        : 'Commercial terms require Sales Manager review.',
      nextRole: chain[0],
    };
  },
};
