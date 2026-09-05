import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { findApprovalLevelsAscending, ApprovalLevelRef } from '../../shared/approvalLevels';
import { dealHealthService } from '../deal-health/deal-health.service';
import { evaluateQuotationDiscounts, RiskLevel } from './discountEngine';
import { discountEngineRepository } from './discount-engine.repository';
import { CheckDiscountsResult } from './discount-engine.model';

const CHECKABLE_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'NEGOTIATION']);

/**
 * Maps a blended risk level to the approval_levels row that should review
 * it: MEDIUM routes to the lowest configured level (e.g. Sales Manager),
 * HIGH routes to the highest configured level (e.g. Finance). There is no
 * separate risk->level mapping table in the shipped schema, so this is
 * derived dynamically from whatever levels admins have configured via
 * /admin/approval-levels, rather than hardcoding level numbers.
 */
function pickApprovalLevel(
  riskLevel: RiskLevel,
  levelsAscending: ApprovalLevelRef[]
): ApprovalLevelRef | null {
  if (riskLevel === 'LOW' || levelsAscending.length === 0) return null;
  return riskLevel === 'HIGH'
    ? levelsAscending[levelsAscending.length - 1]!
    : levelsAscending[0]!;
}

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
    // Step 1 — load state (read-only, outside the transaction).
    const quotation = await discountEngineRepository.findQuotationWithTier(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');

    if (!CHECKABLE_STATUSES.has(quotation.status)) {
      throw Errors.businessRuleViolation(
        `Cannot check discounts on a quotation in status ${quotation.status}`
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

    const targetLevel = pickApprovalLevel(evaluation.riskLevel, approvalLevels);
    if (evaluation.riskLevel !== 'LOW' && !targetLevel) {
      throw Errors.businessRuleViolation(
        'Quotation requires approval but no approval levels are configured'
      );
    }

    // Step 3 — persist: evaluations + status + (conditionally) approval
    // request, atomically. See withTransaction for the rollback guarantee.
    const result = await withTransaction(async (client) => {
      const evaluations = await Promise.all(
        evaluation.items.map((item) =>
          discountEngineRepository.insertEvaluation(client, quotationId, item)
        )
      );

      const newStatus = evaluation.riskLevel === 'LOW' ? 'APPROVED' : 'PENDING_APPROVAL';
      await discountEngineRepository.updateQuotationStatus(client, quotationId, newStatus);

      let approvalRequestId: string | null = null;
      if (targetLevel) {
        approvalRequestId = await discountEngineRepository.createApprovalRequest(client, {
          quotationId,
          requestedBy: quotation.sales_rep_id,
          approvalLevelId: targetLevel.id,
          reason: `Blended risk ${evaluation.riskLevel} (score ${evaluation.blendedScore}) — discount ceiling exceeded on ${evaluation.items.filter((i) => i.overBy > 0).length} line(s)`,
        });
      }

      return {
        quotationId,
        status: newStatus,
        blendedScore: evaluation.blendedScore,
        riskLevel: evaluation.riskLevel,
        evaluations,
        approvalRequestId,
      };
    });

    // Post-commit: the discount outcome is itself a deal-health signal, so
    // refresh the score/alerts once the new evaluation/status is durable.
    await dealHealthService.recalculate(quotationId);

    return result;
  },
};
