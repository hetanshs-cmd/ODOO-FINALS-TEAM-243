import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillmentRepository } from './fulfillment.repository';
import { fulfillmentService } from './fulfillment.service';
import { Fulfillment, FulfillmentItem } from './fulfillment.model';

vi.mock('./fulfillment.repository');
vi.mock('../notifications/notifications.service');
vi.mock('../deal-health/deal-health.service');

const FAKE_CLIENT = { query: vi.fn().mockResolvedValue({ rows: [] }) } as never;
vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

function makeFulfillment(overrides: Partial<Fulfillment> = {}): Fulfillment {
  return {
    id: 'ff-1',
    sales_order_id: 'so-1',
    warehouse_id: 'wh-1',
    status: 'PENDING',
    scheduled_date: null,
    fulfilled_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<FulfillmentItem & { product_id: string }> = {}) {
  return {
    id: 'fi-1',
    fulfillment_id: 'ff-1',
    sales_order_item_id: 'soi-1',
    quantity: '3',
    status: 'PENDING' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    product_id: 'product-1',
    ...overrides,
  };
}

describe('fulfillmentService.acceptSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown fulfillment', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(fulfillmentService.acceptSplit('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects accepting a split that already moved past PENDING', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(
      makeFulfillment({ status: 'SHIPPED' }),
    );

    await expect(fulfillmentService.acceptSplit('ff-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('moves a PENDING fulfillment to IN_PROGRESS', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.updateStatus).mockResolvedValue(
      makeFulfillment({ status: 'IN_PROGRESS' }),
    );

    const result = await fulfillmentService.acceptSplit('ff-1');

    expect(result.status).toBe('IN_PROGRESS');
  });
});

describe('fulfillmentService.overrideSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an empty items list', async () => {
    await expect(fulfillmentService.overrideSplit('ff-1', [])).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects overriding an item not part of this fulfillment', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.findItemForFulfillment).mockResolvedValue(null);

    await expect(
      fulfillmentService.overrideSplit('ff-1', [{ sales_order_item_id: 'soi-x', quantity: 2 }]),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects increasing quantity beyond available inventory', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.findItemForFulfillment).mockResolvedValue(makeItem());
    vi.mocked(fulfillmentRepository.lockInventoryForProducts).mockResolvedValue([
      { warehouse_id: 'wh-1', product_id: 'product-1', quantity_available: '1' },
    ]);

    await expect(
      fulfillmentService.overrideSplit('ff-1', [{ sales_order_item_id: 'soi-1', quantity: 10 }]),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("increases a line quantity and reserves the delta from inventory at THIS fulfillment's warehouse", async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.findItemForFulfillment).mockResolvedValue(makeItem());
    // Deliberately return a different warehouse from lockInventoryForProducts
    // than the fulfillment's own ('wh-1') to prove the service no longer
    // reads from that broad, unfiltered query — it must call
    // lockInventoryAtWarehouse scoped to the fulfillment's warehouse instead.
    vi.mocked(fulfillmentRepository.lockInventoryForProducts).mockResolvedValue([
      { warehouse_id: 'wh-OTHER', product_id: 'product-1', quantity_available: '999' },
    ]);
    vi.mocked(fulfillmentRepository.lockInventoryAtWarehouse).mockResolvedValue({
      warehouse_id: 'wh-1',
      product_id: 'product-1',
      quantity_available: '10',
    });

    await fulfillmentService.overrideSplit('ff-1', [{ sales_order_item_id: 'soi-1', quantity: 5 }]);

    expect(fulfillmentRepository.lockInventoryAtWarehouse).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'wh-1',
      'product-1',
    );
    expect(fulfillmentRepository.reserveInventory).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'wh-1',
      'product-1',
      2,
    );
    expect(fulfillmentRepository.updateItemQuantity).toHaveBeenCalledWith(FAKE_CLIENT, 'fi-1', 5);
  });

  it("rejects the increase when the fulfillment's own warehouse lacks the delta, even if another warehouse has stock", async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.findItemForFulfillment).mockResolvedValue(makeItem());
    vi.mocked(fulfillmentRepository.lockInventoryAtWarehouse).mockResolvedValue({
      warehouse_id: 'wh-1',
      product_id: 'product-1',
      quantity_available: '1', // only 1 available, need 2 more
    });

    await expect(
      fulfillmentService.overrideSplit('ff-1', [{ sales_order_item_id: 'soi-1', quantity: 5 }]),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(fulfillmentRepository.reserveInventory).not.toHaveBeenCalled();
  });

  it('decreases a line quantity and releases the delta back to inventory', async () => {
    vi.mocked(fulfillmentRepository.findByIdForUpdate).mockResolvedValue(makeFulfillment());
    vi.mocked(fulfillmentRepository.findItemForFulfillment).mockResolvedValue(makeItem());

    await fulfillmentService.overrideSplit('ff-1', [{ sales_order_item_id: 'soi-1', quantity: 1 }]);

    expect(fulfillmentRepository.releaseReservation).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'wh-1',
      'product-1',
      2,
    );
    expect(fulfillmentRepository.updateItemQuantity).toHaveBeenCalledWith(FAKE_CLIENT, 'fi-1', 1);
  });
});
