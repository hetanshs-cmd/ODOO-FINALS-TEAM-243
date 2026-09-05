import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscriptionsRepository } from './subscriptions.repository';
import { subscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionPlanForModify } from './subscriptions.model';

/**
 * Unit tests for the subscriptions service — the repository is mocked so
 * these run without a database, per docs/testing.md's "mock repositories"
 * rule (see auth.test.ts for the same pattern in this codebase).
 */
vi.mock('./subscriptions.repository');

const FAKE_CLIENT = {} as never;

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    customer_id: 'customer-1',
    sales_order_id: null,
    quotation_id: null,
    plan_id: 'plan-1',
    status: 'ACTIVE',
    start_date: '2026-01-01',
    end_date: null,
    next_billing_date: '2026-10-01',
    current_price: '100.00',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(overrides: Partial<SubscriptionPlanForModify> = {}): SubscriptionPlanForModify {
  return {
    id: 'plan-1',
    billing_frequency: 'MONTHLY',
    price: '100.00',
    status: 'ACTIVE',
    ...overrides,
  };
}

// withTransaction just runs the callback with a stand-in client — the real
// transaction/rollback behavior is Postgres's, not something to re-verify
// here (see billingDates.test.ts-style unit tests for this codebase's take
// on what belongs in a unit vs integration test).
vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

describe('subscriptionsService.modify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: subscription has one item at quantity 1, so tests that omit
    // `quantity` from the PATCH body (a plan-only change) keep behaving like
    // a single-seat subscription unless a test overrides this explicitly.
    vi.mocked(subscriptionsRepository.sumItemQuantity).mockResolvedValue(1);
  });

  it('rejects an unknown subscription', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(
      subscriptionsService.modify('missing', { plan_id: 'plan-2' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects modifying a cancelled subscription', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ status: 'CANCELLED' }),
    );

    await expect(
      subscriptionsService.modify('sub-1', { plan_id: 'plan-2' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects moving to an inactive plan', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(makeSubscription());
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(
      makePlan({ id: 'plan-2', status: 'INACTIVE' }),
    );

    await expect(
      subscriptionsService.modify('sub-1', { plan_id: 'plan-2' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('applies a plan upgrade and prorates the price delta into a billing_schedules row', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '100.00', next_billing_date: '2026-10-31' }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(
      makePlan({ id: 'plan-2', price: '200.00' }),
    );
    vi.mocked(subscriptionsRepository.applyModification).mockResolvedValue(
      makeSubscription({ plan_id: 'plan-2', current_price: '200.00', status: 'MODIFIED' }),
    );

    const result = await subscriptionsService.modify('sub-1', { plan_id: 'plan-2' });

    expect(result.status).toBe('MODIFIED');
    expect(result.current_price).toBe('200.00');
    expect(subscriptionsRepository.applyModification).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'sub-1',
      expect.objectContaining({ planId: 'plan-2', currentPrice: 200 }),
    );
    // Upgrade (price delta > 0) with a future next_billing_date should
    // create a prorated mid-cycle charge.
    expect(subscriptionsRepository.insertProrationSchedule).toHaveBeenCalledWith(
      FAKE_CLIENT,
      expect.objectContaining({ subscriptionId: 'sub-1' }),
    );
  });

  it('does not create a proration schedule row for a downgrade', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '200.00', next_billing_date: '2026-10-31' }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(
      makePlan({ id: 'plan-2', price: '100.00' }),
    );
    vi.mocked(subscriptionsRepository.applyModification).mockResolvedValue(
      makeSubscription({ plan_id: 'plan-2', current_price: '100.00', status: 'MODIFIED' }),
    );

    await subscriptionsService.modify('sub-1', { plan_id: 'plan-2' });

    expect(subscriptionsRepository.insertProrationSchedule).not.toHaveBeenCalled();
  });

  it('creates a credit note for a downgrade instead of a billing_schedules row', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '200.00', next_billing_date: '2026-10-31' }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(
      makePlan({ id: 'plan-2', price: '100.00' }),
    );
    vi.mocked(subscriptionsRepository.applyModification).mockResolvedValue(
      makeSubscription({ plan_id: 'plan-2', current_price: '100.00', status: 'MODIFIED' }),
    );

    await subscriptionsService.modify('sub-1', { plan_id: 'plan-2' });

    expect(subscriptionsRepository.insertCreditNote).toHaveBeenCalledWith(
      FAKE_CLIENT,
      expect.objectContaining({ subscriptionId: 'sub-1', customerId: 'customer-1' }),
    );
  });

  it('derives quantity from the subscription\'s items when omitted, instead of defaulting to 1', async () => {
    // A plan-only change (no `quantity` in the request) used to silently
    // treat the subscription as quantity 1, collapsing a 5-seat
    // subscription's price to a single seat's price on any plan-only PATCH.
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '500.00', next_billing_date: null }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(makePlan({ id: 'plan-2', price: '100.00' }));
    vi.mocked(subscriptionsRepository.sumItemQuantity).mockResolvedValue(5);
    vi.mocked(subscriptionsRepository.applyModification).mockResolvedValue(
      makeSubscription({ plan_id: 'plan-2', current_price: '500.00', status: 'MODIFIED' }),
    );

    await subscriptionsService.modify('sub-1', { plan_id: 'plan-2' });

    expect(subscriptionsRepository.applyModification).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'sub-1',
      expect.objectContaining({ currentPrice: 500 }), // 100 * 5, not 100 * 1
    );
  });

  it('refuses to modify a subscription with no items when quantity is omitted', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(makeSubscription());
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(makePlan({ id: 'plan-2' }));
    vi.mocked(subscriptionsRepository.sumItemQuantity).mockResolvedValue(null);

    await expect(
      subscriptionsService.modify('sub-1', { plan_id: 'plan-2' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('applies quantity as a multiplier against the plan price', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '100.00', next_billing_date: null }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(makePlan({ price: '100.00' }));
    vi.mocked(subscriptionsRepository.applyModification).mockResolvedValue(
      makeSubscription({ current_price: '300.00', status: 'MODIFIED' }),
    );

    await subscriptionsService.modify('sub-1', { quantity: 3 });

    expect(subscriptionsRepository.applyModification).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'sub-1',
      expect.objectContaining({ currentPrice: 300 }),
    );
  });
});

describe('subscriptionsService.cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown subscription', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(subscriptionsService.cancel('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects cancelling an already-cancelled subscription', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ status: 'CANCELLED' }),
    );

    await expect(subscriptionsService.cancel('sub-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('cancels an active subscription and clears next_billing_date', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(makeSubscription());
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(makePlan());
    vi.mocked(subscriptionsRepository.cancel).mockResolvedValue(
      makeSubscription({ status: 'CANCELLED', next_billing_date: null, end_date: '2026-09-05' }),
    );

    const result = await subscriptionsService.cancel('sub-1');

    expect(result.status).toBe('CANCELLED');
    expect(result.next_billing_date).toBeNull();
    expect(subscriptionsRepository.cancel).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'sub-1',
      expect.objectContaining({ endDate: expect.any(String) }),
    );
  });

  it('creates a credit note for the unused portion of an active cycle on cancel', async () => {
    vi.mocked(subscriptionsRepository.findByIdForUpdate).mockResolvedValue(
      makeSubscription({ current_price: '100.00', next_billing_date: '2026-10-31' }),
    );
    vi.mocked(subscriptionsRepository.findPlanById).mockResolvedValue(makePlan());
    vi.mocked(subscriptionsRepository.cancel).mockResolvedValue(
      makeSubscription({ status: 'CANCELLED', next_billing_date: null }),
    );

    await subscriptionsService.cancel('sub-1');

    expect(subscriptionsRepository.insertCreditNote).toHaveBeenCalledWith(
      FAKE_CLIENT,
      expect.objectContaining({ subscriptionId: 'sub-1', customerId: 'customer-1' }),
    );
  });
});
