import { describe, it, expect, vi, beforeEach } from 'vitest';
import { backordersRepository } from './backorders.repository';
import { fulfillmentRepository } from './fulfillment.repository';
import { dealHealthService } from '../deal-health/deal-health.service';
import { backordersService } from './backorders.service';
import { Backorder } from './backorders.model';
import { Fulfillment } from './fulfillment.model';

vi.mock('./backorders.repository');
vi.mock('./fulfillment.repository');
vi.mock('../deal-health/deal-health.service');

const FAKE_CLIENT = {} as never;
vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

function makeBackorder(overrides: Partial<Backorder> = {}): Backorder {
  return {
    id: 'bo-1',
    sales_order_id: 'so-1',
    sales_order_item_id: 'soi-1',
    product_id: 'product-1',
    quantity: '5',
    status: 'OPEN',
    expected_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    fulfilled_at: null,
    ...overrides,
  };
}

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

describe('backordersService.consolidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown backorder', async () => {
    vi.mocked(backordersRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(backordersService.consolidate('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects consolidating an already-fulfilled backorder', async () => {
    vi.mocked(backordersRepository.findByIdForUpdate).mockResolvedValue(
      makeBackorder({ status: 'FULFILLED' }),
    );

    await expect(backordersService.consolidate('bo-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects when no warehouse has enough available inventory', async () => {
    vi.mocked(backordersRepository.findByIdForUpdate).mockResolvedValue(makeBackorder());
    vi.mocked(fulfillmentRepository.lockInventoryForProducts).mockResolvedValue([
      { warehouse_id: 'wh-1', product_id: 'product-1', quantity_available: '2' },
    ]);

    await expect(backordersService.consolidate('bo-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('creates a fulfillment and marks the backorder fulfilled when inventory covers it', async () => {
    vi.mocked(backordersRepository.findByIdForUpdate).mockResolvedValue(makeBackorder());
    vi.mocked(fulfillmentRepository.lockInventoryForProducts).mockResolvedValue([
      { warehouse_id: 'wh-1', product_id: 'product-1', quantity_available: '10' },
    ]);
    vi.mocked(fulfillmentRepository.insertFulfillment).mockResolvedValue(makeFulfillment());
    vi.mocked(backordersRepository.markFulfilled).mockResolvedValue(
      makeBackorder({ status: 'FULFILLED' }),
    );
    vi.mocked(fulfillmentRepository.findQuotationIdForSalesOrder).mockResolvedValue('quote-1');

    const result = await backordersService.consolidate('bo-1');

    expect(result.backorder.status).toBe('FULFILLED');
    expect(fulfillmentRepository.reserveInventory).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'wh-1',
      'product-1',
      5,
    );
    expect(dealHealthService.recalculate).toHaveBeenCalledWith('quote-1');
  });
});
