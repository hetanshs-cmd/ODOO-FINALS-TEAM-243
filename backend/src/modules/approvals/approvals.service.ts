import { AppError, Errors } from '../../errors/AppError';
import { mapDbError } from '../../shared/crud/dbErrors';
import { withTransaction } from '../../shared/db/withTransaction';
import { findApprovalLevelsAscending } from '../../shared/approvalLevels';
import { insertAuditLog } from '../../shared/auditLog';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { approvalsRepository } from './approvals.repository';
import { ApprovalAction, ApprovalActionRow, ApprovalRequest } from './approvals.model';
import { AuthenticatedUser } from '../auth/auth.types';

interface ActOnApprovalDto {
  action: ApprovalAction;
  userId: string;
  /** Role of the acting user — ADMIN may override an assigned_to restriction. */
  actorRole: string;
  comment?: string | null;
}

interface ActOnApprovalResult {
  request: ApprovalRequest;
  action: ApprovalActionRow;
  escalatedRequestId: string | null;
}

export const approvalsService = {
  async list(
    query: {
      status?: string;
      page?: unknown;
      limit?: unknown;
    },
    requester: AuthenticatedUser,
  ): Promise<PaginatedResult<ApprovalRequest>> {
    // A sales rep only sees approval requests raised on their own
    // quotations; managers/admins see everything (matches the route
    // comment's stated intent, now actually enforced at the query level).
    const requestedBy = requester.role === 'SALES_REP' ? requester.id : undefined;
    const pagination = getPaginationParams(query);
    const [items, total] = await Promise.all([
      approvalsRepository.list(query.status, requestedBy, pagination.limit, pagination.offset),
      approvalsRepository.count(query.status, requestedBy),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async getDetail(id: string, requester: AuthenticatedUser) {
    const request = await approvalsRepository.findById(id);
    if (!request) throw Errors.notFound('Approval request');
    if (requester.role === 'SALES_REP' && request.requested_by !== requester.id) {
      throw Errors.forbidden();
    }

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
    try {
      return await withTransaction(async (client) => {
      // Lock and re-check inside the transaction — see findByIdForUpdate.
      const request = await approvalsRepository.findByIdForUpdate(client, approvalRequestId);
      if (!request) throw Errors.notFound('Approval request');

      if (dto.action !== 'COMMENTED' && request.status !== 'PENDING') {
        throw Errors.businessRuleViolation(
          `This approval request has already been resolved (status: ${request.status})`,
        );
      }

      // Segregation of duties: a request routed to a specific approver may
      // only be actioned by that approver (an ADMIN can always step in). The
      // assigned_to column existed but was never checked, so any manager
      // could approve any request — including one escalated away from them,
      // making the multi-level chain purely cosmetic.
      if (
        dto.action !== 'COMMENTED' &&
        request.assigned_to !== null &&
        request.assigned_to !== dto.userId &&
        dto.actorRole !== 'ADMIN'
      ) {
        throw Errors.forbidden();
      }

      // A rep must never be able to approve the discount they requested,
      // even if they also hold an approving role.
      if (dto.action !== 'COMMENTED' && request.requested_by === dto.userId) {
        throw Errors.businessRuleViolation(
          'You cannot act on an approval request you raised yourself',
        );
      }

      const actionRow = await approvalsRepository.insertAction(client, {
        approvalRequestId,
        userId: dto.userId,
        action: dto.action,
        comment: dto.comment ?? null,
      });

      let updatedRequest = request;
      let escalatedRequestId: string | null = null;

      if (dto.action === 'APPROVED') {
        updatedRequest = await approvalsRepository.updateStatus(
          client,
          approvalRequestId,
          'APPROVED',
        );
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'APPROVED');
      } else if (dto.action === 'REJECTED') {
        updatedRequest = await approvalsRepository.updateStatus(
          client,
          approvalRequestId,
          'REJECTED',
        );
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'REJECTED');
      } else if (dto.action === 'CANCELLED') {
        updatedRequest = await approvalsRepository.updateStatus(
          client,
          approvalRequestId,
          'CANCELLED',
        );
        // Returned to the rep for rework — matches docs/architecture.md's
        // approval-workflow "return" outcome.
        await approvalsRepository.updateQuotationStatus(client, request.quotation_id, 'DRAFT');
      } else if (dto.action === 'ESCALATED') {
        updatedRequest = await approvalsRepository.updateStatus(
          client,
          approvalRequestId,
          'ESCALATED',
        );

        const levels = await findApprovalLevelsAscending();
        const currentIndex = levels.findIndex((l) => l.id === request.approval_level_id);
        const nextLevel = currentIndex >= 0 ? levels[currentIndex + 1] : undefined;
        if (!nextLevel) {
          throw Errors.businessRuleViolation(
            'Cannot escalate: no higher approval level is configured',
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

      await insertAuditLog(client, {
        entityType: 'quotation',
        entityId: request.quotation_id,
        action: `APPROVAL_${dto.action}`,
        actorId: dto.userId,
        oldValue: { status: request.status },
        newValue: { status: updatedRequest.status, escalatedRequestId },
      });

        return { request: updatedRequest, action: actionRow, escalatedRequestId };
      });
    } catch (err) {
      // uq_approval_requests_one_pending_per_quotation (migration 026) is the
      // final backstop against a concurrent discountEngine.checkDiscounts
      // re-evaluation (which locks the quotation row, not this request)
      // racing an escalation — translate that 23505 into a clean 409.
      if (err instanceof AppError) throw err;
      throw mapDbError(err, 'Approval request');
    }
  },
};
