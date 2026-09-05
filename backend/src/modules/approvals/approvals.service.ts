import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { findApprovalLevelsAscending } from '../../shared/approvalLevels';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { approvalsRepository } from './approvals.repository';
import { ApprovalAction, ApprovalActionRow, ApprovalRequest } from './approvals.model';

interface ActOnApprovalDto {
  action: ApprovalAction;
  userId: string;
  comment?: string | null;
}

interface ActOnApprovalResult {
  request: ApprovalRequest;
  action: ApprovalActionRow;
  escalatedRequestId: string | null;
}

export const approvalsService = {
  async list(query: {
    status?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<ApprovalRequest>> {
    const pagination = getPaginationParams(query);
    const [items, total] = await Promise.all([
      approvalsRepository.list(query.status, pagination.limit, pagination.offset),
      approvalsRepository.count(query.status),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async getDetail(id: string) {
    const request = await approvalsRepository.findById(id);
    if (!request) throw Errors.notFound('Approval request');

    const [actions, riskBreakdown] = await Promise.all([
      approvalsRepository.listActions(id),
      approvalsRepository.findLatestEvaluationsForQuotation(request.quotation_id),
    ]);

    return { ...request, actions, riskBreakdown };
  },

  /**
   * One explicit step sequence per action — log the action, then apply its
   * consequence (quotation status change, or a new escalated request) — run
   * as a single transaction (docs/references.md: Medusa Workflows) so an
   * escalation that has nowhere to go rolls back the action log entry too,
   * rather than leaving an orphaned "ESCALATED" action with no follow-up
   * request.
   */
  async act(approvalRequestId: string, dto: ActOnApprovalDto): Promise<ActOnApprovalResult> {
    const request = await approvalsRepository.findById(approvalRequestId);
    if (!request) throw Errors.notFound('Approval request');

    if (dto.action !== 'COMMENTED' && request.status !== 'PENDING') {
      throw Errors.businessRuleViolation(
        `This approval request has already been resolved (status: ${request.status})`
      );
    }

    return withTransaction(async (client) => {
      const actionRow = await approvalsRepository.insertAction(client, {
        approvalRequestId,
        userId: dto.userId,
        action: dto.action,
        comment: dto.comment ?? null,
      });

      let updatedRequest = request;
      let escalatedRequestId: string | null = null;

      if (dto.action === 'APPROVED') {
        updatedRequest = await approvalsRepository.updateStatus(client, approvalRequestId, 'APPROVED');
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'APPROVED');
      } else if (dto.action === 'REJECTED') {
        updatedRequest = await approvalsRepository.updateStatus(client, approvalRequestId, 'REJECTED');
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'REJECTED');
      } else if (dto.action === 'CANCELLED') {
        updatedRequest = await approvalsRepository.updateStatus(client, approvalRequestId, 'CANCELLED');
        // Returned to the rep for rework — matches docs/architecture.md's
        // approval-workflow "return" outcome.
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'DRAFT');
      } else if (dto.action === 'ESCALATED') {
        updatedRequest = await approvalsRepository.updateStatus(client, approvalRequestId, 'ESCALATED');

        const levels = await findApprovalLevelsAscending();
        const currentIndex = levels.findIndex((l) => l.id === request.approval_level);
        const nextLevel = currentIndex >= 0 ? levels[currentIndex + 1] : undefined;
        if (!nextLevel) {
          throw Errors.businessRuleViolation(
            'Cannot escalate: no higher approval level is configured'
          );
        }

        escalatedRequestId = await approvalsRepository.createEscalatedRequest(client, {
          quotationId: request.quotation_id,
          requestedBy: request.requested_by,
          approvalLevelId: nextLevel.id,
          reason: `Escalated from approval request ${approvalRequestId}${
            dto.comment ? `: ${dto.comment}` : ''
          }`,
        });
      }
      // COMMENTED: the action log entry itself is the only effect.

      return { request: updatedRequest, action: actionRow, escalatedRequestId };
    });
  },
};
