import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { BillingFrequency } from '../billing/billingDates';
import { subscriptionsRepository } from './subscriptions.repository';
import { Subscription } from './subscriptions.model';

// Approximate cycle length per billing_frequency, used only to size the
// denominator of the proration fraction — the same rough-days approach
// Ghost uses for its "days_remaining / total_days * price_delta" proration
// (docs/references.md, Ghost entry). Exact calendar-day cycle boundaries
// aren't tracked on `subscriptions` (only next_billing_date is), so this is
// a documented approximation, not a bug.
const CYCLE_DAYS: Record<BillingFrequency, number> = {
  MONTHLY: 30,
  QUARTERLY: 91,
  YEARLY: 365,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ghost-style proration: charge only for the days remaining in the current
 * cycle. Returns 0 (no schedule row created) once next_billing_date has
 * already passed or the delta itself is non-positive.
 */
function prorateForCycle(priceDelta: number, nextBillingDate: string, frequency: BillingFrequency): number {
  if (priceDelta <= 0) return 0;

  const totalDays = CYCLE_DAYS[frequency];
  const next = new Date(`${nextBillingDate}T00:00:00Z`).getTime();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.min(totalDays, Math.round((next - now) / MS_PER_DAY)));

  return roundMoney(priceDelta * (daysRemaining / totalDays));
}

export const subscriptionsService = {
  /**
   * PATCH /subscriptions/:id
   *
   * Accepts plan_id and/or quantity. current_price is modeled as
   * plan.price × quantity (quantity defaults to 1 when omitted) — this
   * module doesn't track a separate top-level quantity column (only
   * subscription_items do, one row per product), so a bare "change
   * quantity" request is interpreted against the subscription's current
   * plan. This is a documented simplification, mirrored on the
   * billing.service.ts precedent of stating assumptions explicitly rather
   * than guessing silently.
   *
   * An upgrade (price increase) gets an immediate prorated billing_schedules
   * charge for the remainder of the current cycle. A downgrade takes effect
   * for future cycles only — billing_schedules.amount has a >= 0 CHECK
   * constraint, so there's no schedule row to create for a negative delta,
   * and this module doesn't implement refunds.
   */
  async modify(id: string, input: { plan_id?: string; quantity?: number }): Promise<Subscription> {
    return withTransaction(async (client) => {
      const subscription = await subscriptionsRepository.findByIdForUpdate(client, id);
      if (!subscription) throw Errors.notFound('Subscription');
      if (subscription.status === 'CANCELLED') {
        throw Errors.businessRuleViolation('Cannot modify a cancelled subscription');
      }

      const planId = input.plan_id ?? subscription.plan_id;
      const plan = await subscriptionsRepository.findPlanById(client, planId);
      if (!plan) throw Errors.notFound('Subscription plan');
      if (plan.status !== 'ACTIVE') {
        throw Errors.businessRuleViolation('Cannot move a subscription to an inactive plan');
      }

      const quantity = input.quantity ?? 1;
      const newPrice = roundMoney(Number(plan.price) * quantity);
      const priceDelta = roundMoney(newPrice - Number(subscription.current_price));

      if (priceDelta > 0 && subscription.next_billing_date) {
        const prorated = prorateForCycle(priceDelta, subscription.next_billing_date, plan.billing_frequency);
        if (prorated > 0) {
          await subscriptionsRepository.insertProrationSchedule(client, {
            subscriptionId: subscription.id,
            billingDate: todayIso(),
            amount: prorated,
          });
        }
      }

      return subscriptionsRepository.applyModification(client, subscription.id, {
        planId,
        currentPrice: newPrice,
      });
    });
  },

  /**
   * POST /subscriptions/:id/cancel
   *
   * Sets status = CANCELLED and end_date = today (the cancellation date —
   * `subscriptions` has no dedicated cancelled_at/cancellation_reason
   * columns, so end_date is the field the schema actually supports for
   * this). Clears next_billing_date so no further billing_schedules rows
   * get generated for it.
   */
  async cancel(id: string): Promise<Subscription> {
    return withTransaction(async (client) => {
      const subscription = await subscriptionsRepository.findByIdForUpdate(client, id);
      if (!subscription) throw Errors.notFound('Subscription');
      if (subscription.status === 'CANCELLED') {
        throw Errors.businessRuleViolation('Subscription is already cancelled');
      }

      return subscriptionsRepository.cancel(client, subscription.id, { endDate: todayIso() });
    });
  },
};
