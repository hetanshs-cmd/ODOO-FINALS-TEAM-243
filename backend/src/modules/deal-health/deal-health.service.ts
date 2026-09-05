import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { calculateDealHealth } from './dealHealth';
import { dealHealthRepository } from './deal-health.repository';

function daysSince(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export const dealHealthService = {
  /**
   * Recomputes the deal-health score for a quotation from its current
   * discount-risk, negotiation, staleness, and fulfillment-delay signals,
   * persists the score, and opens any newly-triggered alerts (skipping
   * alert types that already have an OPEN alert, so re-running this doesn't
   * spam duplicate alerts on every recalculation).
   */
  async recalculate(quotationId: string) {
    const quotation = await dealHealthRepository.findQuotationForHealth(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');

    const [discountRiskScore, negotiationRounds, fulfillmentDelayDays] = await Promise.all([
      dealHealthRepository.findLatestDiscountRiskScore(quotationId),
      dealHealthRepository.countNegotiationRounds(quotationId),
      dealHealthRepository.findFulfillmentDelayDays(quotationId),
    ]);

    const result = calculateDealHealth({
      latestDiscountRiskScore: discountRiskScore,
      negotiationRoundCount: negotiationRounds,
      daysSinceLastActivity: daysSince(new Date(quotation.updated_at)),
      fulfillmentDelayDays,
    });

    return withTransaction(async (client) => {
      const score = await dealHealthRepository.insertScore(client, {
        quotationId,
        score: roundMoney(result.score),
        riskLevel: result.riskLevel,
        discountRisk: roundMoney(result.discountRisk),
        negotiationRisk: roundMoney(result.negotiationRisk),
        delayRisk: roundMoney(result.delayRisk),
        fulfillmentRisk: roundMoney(result.fulfillmentRisk),
      });

      const newAlerts = [];
      for (const alert of result.alerts) {
        const existing = await dealHealthRepository.findOpenAlertOfType(quotationId, alert.type);
        if (existing) continue;
        newAlerts.push(
          await dealHealthRepository.insertAlert(client, {
            quotationId,
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message,
          })
        );
      }

      return { score, newAlerts };
    });
  },

  async getLatest(quotationId: string) {
    const quotation = await dealHealthRepository.findQuotationForHealth(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    const [score, alerts] = await Promise.all([
      dealHealthRepository.findLatestScore(quotationId),
      dealHealthRepository.listOpenAlertsForQuotation(quotationId),
    ]);
    return { score, alerts };
  },

  async listOpenAlerts(query: { page?: unknown; limit?: unknown }) {
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      dealHealthRepository.listOpenAlerts(limit, offset),
      dealHealthRepository.countOpenAlerts(),
    ]);
    return { items, total, page, limit };
  },

  async updateAlertStatus(alertId: string, status: 'ESCALATED' | 'NUDGED' | 'RESOLVED') {
    const updated = await dealHealthRepository.updateAlertStatus(alertId, status);
    if (!updated) throw Errors.notFound('Deal alert');
    return updated;
  },
};
