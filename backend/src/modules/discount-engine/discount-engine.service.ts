import { AppError, Errors } from '../../errors/AppError';
import { mapDbError } from '../../shared/crud/dbErrors';
import { withTransaction } from '../../shared/db/withTransaction';
import { findApprovalLevelsAscending, approvalChainForRisk } from '../../shared/approvalLevels';
import { dealHealthService } from '../deal-health/deal-health.service';
import { insertAuditLog } from '../../shared/auditLog';
import { runPostCommit } from '../../shared/postCommit';
import { evaluateQuotationDiscounts } from './discountEngine';
import { discountEngineRepository } from './discount-engine.repository';
import { CheckDiscountsResult } from './discount-engine.model';

const CHECKABLE_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'NEGOTIATION']);

export const discountEngineService = {
  /**
   * check-discounts: the discount-check -> evaluation-persist -> status
   * update -> approval-creation chain, run as one explicit step sequence
   * inside a DB transaction (docs/references.md: Medusa Workflows) so a
   * failure partway through (e.g. approval_requests insert fails) rolls
   * back the evaluation rows and status change instead of leaving the
   * quotation half-updated.
   */
  async checkDiscounts(quotationId: string): Promise<CheckDiscountsResult> {
    // Step 1 — load state. The status is re-checked under a row lock inside
    // the transaction below; this read only shapes the evaluation inputs.
    const quotation = await discountEngineRepository.findQuotationWithTier(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');

    if (!CHECKABLE_STATUSES.has(quotation.status)) {
      throw Errors.businessRuleViolation(
        `Cannot check discounts on a quotation in status ${quotation.status}`,
      );
    }

    const items = await discountEngineRepository.findItemsForEvaluation(quotationId);
    if (items.length === 0) {
      throw Errors.businessRuleViolation('Quotation has no items to evaluate');
    }

    const [rules, approvalLevels] = await Promise.all([
      discountEngineRepository.findActiveDiscountRules(),
      findApprovalLevelsAscending(),
    ]);

    // Step 2 — pure evaluation (no I/O, already unit-tested in isolation).
    const evaluation = evaluateQuotationDiscounts(items, rules, quotation.customer_tier_id);

    // The full ordered chain this risk level must clear (e.g. HIGH ->
    // Sales Manager then Finance). The request is always opened at the FIRST
    // step; approvals.service advances to the next step on each approval.
    const chain = approvalChainForRisk(evaluation.riskLevel, approvalLevels);
    const targetLevel = chain[0] ?? null;
    if (evaluation.riskLevel !== 'LOW' && !targetLevel) {
      throw Errors.businessRuleViolation(
        'Quotation requires approval but no approval levels are configured',
      );
    }

    // Step 3 — persist: evaluations + status + (conditionally) approval
    // request, atomically. See withTransaction for the rollback guarantee.
    // The DB's uq_approval_requests_one_pending_per_quotation index (see
    // migration 026) is the final backstop against a concurrent escalation
    // (approvals.service.ts::act, which locks a different row) racing this
    // insert — translate that 23505 into a clean 409 instead of a raw 500.
    let result;
    try {
      result = await withTransaction(async (client) => {
        // Re-check the status under a row lock: two concurrent submits/checks
        // both used to pass the check above and each write a full set of
        // evaluations plus an approval request.
        const lockedStatus = await discountEngineRepository.lockQuotationStatus(
          client,
          quotationId,
        );
        if (lockedStatus === null) throw Errors.notFound('Quotation');
        if (!CHECKABLE_STATUSES.has(lockedStatus)) {
          throw Errors.businessRuleViolation(
            `Cannot check discounts on a quotation in status ${lockedStatus}`,
          );
        }

        const evaluations = await Promise.all(
          evaluation.items.map((item) =>
            discountEngineRepository.insertEvaluation(client, quotationId, item),
          ),
        );

        const newStatus = evaluation.riskLevel === 'LOW' ? 'APPROVED' : 'PENDING_APPROVAL';
        await discountEngineRepository.updateQuotationStatus(client, quotationId, newStatus);

        // Any earlier PENDING request is now stale — this evaluation supersedes
        // it, whether or not a new request is raised.
        await discountEngineRepository.supersedePendingApprovalRequests(client, quotationId);

        let approvalRequestId: string | null = null;
        if (targetLevel) {
          approvalRequestId = await discountEngineRepository.createApprovalRequest(client, {
            quotationId,
            requestedBy: quotation.sales_rep_id,
            approvalLevelId: targetLevel.id,
            reason: `Blended risk ${evaluation.riskLevel} (score ${evaluation.blendedScore}) — discount ceiling exceeded on ${evaluation.items.filter((i) => i.overBy > 0).length} line(s)`,
          });
        }

        await insertAuditLog(client, {
          entityType: 'quotation',
          entityId: quotationId,
          action: 'DISCOUNT_CHECK',
          actorId: quotation.sales_rep_id,
          newValue: {
            status: newStatus,
            blendedScore: evaluation.blendedScore,
            riskLevel: evaluation.riskLevel,
            approvalRequestId,
          },
        });

        return {
          quotationId,
          status: newStatus,
          blendedScore: evaluation.blendedScore,
          riskLevel: evaluation.riskLevel,
          evaluations,
          approvalRequestId,
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw mapDbError(err, 'Approval request');
    }

    // Post-commit: the discount outcome is itself a deal-health signal, so
    // refresh the score/alerts once the new evaluation/status is durable.
    // Failing here must not 500 an evaluation that already committed.
    await runPostCommit('discountEngine.checkDiscounts', () =>
      dealHealthService.recalculate(quotationId).then(() => undefined),
    );

    return result;
  },
};
