import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { BillingFrequency, computeNextBillingDate } from '../billing/billingDates';
import { calculateRefund } from './creditNoteCalculator';
import { subscriptionsRepository } from './subscriptions.repository';
import { Subscription } from './subscriptions.model';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ghost-style proration: charge only for the days remaining in the current
 * cycle. Returns 0 (no schedule row created) once next_billing_date has
 * already passed or the delta itself is non-positive.
 *
 * Delegates to calculateRefund — an upgrade charge and a downgrade refund are
 * the same "days_remaining / total_days × amount" calculation applied in
 * opposite directions, and keeping two copies (each with its own CYCLE_DAYS
 * and MS_PER_DAY constants) invited them to drift apart.
 */
function prorateForCycle(
  priceDelta: number,
  nextBillingDate: string,
  frequency: BillingFrequency,
): number {
  if (priceDelta <= 0) return 0;
  return roundMoney(
    calculateRefund({
      amount: priceDelta,
      nextBillingDate,
      billingFrequency: frequency,
    }),
  );
}

export const subscriptionsService = {
  async list(query: {
    status?: string;
    customer_id?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<Subscription>> {
    const pagination = getPaginationParams(query);
    const filters = { status: query.status, customerId: query.customer_id };
    const [items, total] = await Promise.all([
      subscriptionsRepository.list(filters, pagination.limit, pagination.offset),
      subscriptionsRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async getById(id: string): Promise<Subscription> {
    const subscription = await subscriptionsRepository.findById(id);
    if (!subscription) throw Errors.notFound('Subscription');
    return subscription;
  },

  /**
   * PATCH /subscriptions/:id
   *
   * Accepts plan_id and/or quantity. current_price is modeled as
   * plan.price × quantity. `subscriptions` has no top-level quantity column
   * (only subscription_items do, one row per product), so an omitted
   * `quantity` means "unchanged" and is derived by summing the subscription's
   * items — it must NOT fall back to 1, which silently collapsed a
   * multi-seat subscription's price on a plan-only change.
   *
   * An upgrade (price increase) gets an immediate prorated billing_schedules
   * charge for the remainder of the current cycle. A downgrade creates a
   * credit_notes row for the prorated refund (billing_schedules.amount has a
   * >= 0 CHECK, so it cannot carry a negative delta).
   *
   * Changing the plan's billing frequency also re-bases next_billing_date, so
   * a MONTHLY -> YEARLY move doesn't keep billing on the old monthly cadence
   * at the new price.
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

      const currentPlan = await subscriptionsRepository.findPlanById(client, subscription.plan_id);

      let quantity = input.quantity;
      if (quantity === undefined) {
        const derived = await subscriptionsRepository.sumItemQuantity(client, subscription.id);
        if (derived === null) {
          throw Errors.businessRuleViolation(
            'Subscription has no items, so quantity cannot be inferred — supply quantity explicitly',
          );
        }
        quantity = derived;
      }

      const newPrice = roundMoney(Number(plan.price) * quantity);
      const priceDelta = roundMoney(newPrice - Number(subscription.current_price));

      // Only re-base the billing date when the cadence itself changed.
      const frequencyChanged =
        currentPlan !== null && currentPlan.billing_frequency !== plan.billing_frequency;
      const nextBillingDate = frequencyChanged
        ? computeNextBillingDate(new Date(), plan.billing_frequency)
        : null;

      if (priceDelta > 0 && subscription.next_billing_date) {
        const prorated = prorateForCycle(
          priceDelta,
          subscription.next_billing_date,
          plan.billing_frequency,
        );
        if (prorated > 0) {
          await subscriptionsRepository.insertProrationSchedule(client, {
            subscriptionId: subscription.id,
            billingDate: todayIso(),
            amount: prorated,
          });
        }
      } else if (priceDelta < 0) {
        // Downgrade: billing_schedules.amount has a >= 0 CHECK, so instead
        // of the previous silent skip, refund the unused portion of the
        // price delta for the remainder of the current cycle as a
        // credit_notes row.
        const refund = calculateRefund({
          amount: Math.abs(priceDelta),
          nextBillingDate: subscription.next_billing_date,
          billingFrequency: plan.billing_frequency,
        });
        if (refund > 0) {
          await subscriptionsRepository.insertCreditNote(client, {
            subscriptionId: subscription.id,
            customerId: subscription.customer_id,
            amount: refund,
            reason: `Prorated refund for plan downgrade on subscription ${subscription.id}`,
          });
        }
      }

      return subscriptionsRepository.applyModification(client, subscription.id, {
        planId,
        currentPrice: newPrice,
        nextBillingDate,
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

      if (subscription.next_billing_date) {
        const plan = await subscriptionsRepository.findPlanById(client, subscription.plan_id);
        if (plan) {
          const refund = calculateRefund({
            amount: Number(subscription.current_price),
            nextBillingDate: subscription.next_billing_date,
            billingFrequency: plan.billing_frequency,
          });
          if (refund > 0) {
            await subscriptionsRepository.insertCreditNote(client, {
              subscriptionId: subscription.id,
              customerId: subscription.customer_id,
              amount: refund,
              reason: `Prorated refund for cancellation of subscription ${subscription.id}`,
            });
          }
        }
      }

      return subscriptionsRepository.cancel(client, subscription.id, { endDate: todayIso() });
    });
  },
};
