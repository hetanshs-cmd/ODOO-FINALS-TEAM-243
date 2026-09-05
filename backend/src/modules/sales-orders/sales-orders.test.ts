import { describe, it, expect, vi, beforeEach } from 'vitest';
import { salesOrdersRepository } from './sales-orders.repository';
import { salesOrdersService } from './sales-orders.service';
import { QuotationForConversion, QuotationItemForConversion } from './sales-orders.repository';

/**
 * Unit tests for convertFromQuotation — this is the fix for the P0 finding
 * in CODEBASE_AUDIT.md (AUD-001): CONVERTIBLE_STATUSES used to be
 * Set(['ACCEPTED']) with no code path anywhere writing ACCEPTED, so this
 * endpoint always 422'd and the entire downstream pipeline (fulfillment,
 * billing, invoicing) was unreachable. It now also accepts APPROVED, and
 * the status check runs under a row lock inside the transaction.
 */
vi.mock('./sales-orders.repository');

const FAKE_CLIENT = {} as never;

vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

function makeQuotation(overrides: Partial<QuotationForConversion> = {}): QuotationForConversion {
  return {
    id: 'quote-1',
    status: 'APPROVED',
    customer_id: 'customer-1',
    sales_rep_id: 'rep-1',
    ...overrides,
  };
}

function makeItem(overrides: Partial<QuotationItemForConversion> = {}): QuotationItemForConversion {
  return {
    id: 'qi-1',
    product_id: 'product-1',
    quantity: '1',
    unit_price: '100.00',
    discount_amount: '0.00',
    tax_percent: '0',
    billing_type: 'ONE_TIME',
    ...overrides,
  };
}

describe('salesOrdersService.convertFromQuotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salesOrdersRepository.insert).mockResolvedValue({
      id: 'so-1',
      order_number: 'SO-20260101-ABC123',
      quotation_id: 'quote-1',
      customer_id: 'customer-1',
      sales_rep_id: 'rep-1',
      status: 'PENDING',
      order_date: '2026-01-01',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(salesOrdersRepository.insertItem).mockImplementation(async (_client, input) => ({
      id: 'soi-1',
      sales_order_id: input.sales_order_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_price: input.unit_price,
      discount: input.discount,
      tax_percent: input.tax_percent,
      total: '100.00',
      fulfilled_quantity: '0',
      created_at: '2026-01-01T00:00:00.000Z',
    }));
    vi.mocked(salesOrdersRepository.findTotals).mockResolvedValue({
      subtotal: '100.00',
      discount_total: '0.00',
      tax_total: '0.00',
      grand_total: '100.00',
    });
  });

  it('rejects an unknown quotation', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(null);

    await expect(salesOrdersService.convertFromQuotation('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('converts an APPROVED quotation (the documented, previously-unreachable path)', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation({ status: 'APPROVED' }),
    );

    const result = await salesOrdersService.convertFromQuotation('quote-1');

    expect(result.id).toBe('so-1');
    expect(result.items).toHaveLength(1);
    expect(salesOrdersRepository.markQuotationConverted).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'quote-1',
    );
  });

  it('converts an ACCEPTED quotation (the portal-confirm path)', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation({ status: 'ACCEPTED' }),
    );

    await expect(salesOrdersService.convertFromQuotation('quote-1')).resolves.toMatchObject({
      id: 'so-1',
    });
  });

  it('rejects a quotation that has not cleared governance yet', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation({ status: 'PENDING_APPROVAL' }),
    );

    await expect(salesOrdersService.convertFromQuotation('quote-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects a quotation that was already converted (re-checked under the lock)', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation({ status: 'CONVERTED' }),
    );

    await expect(salesOrdersService.convertFromQuotation('quote-1')).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(salesOrdersRepository.insert).not.toHaveBeenCalled();
  });

  it('reads the quotation under a row lock, not the unlocked read', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([makeItem()]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation(),
    );

    await salesOrdersService.convertFromQuotation('quote-1');

    expect(salesOrdersRepository.findQuotationForConversionForUpdate).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'quote-1',
    );
    expect(salesOrdersRepository.findQuotationForConversion).not.toHaveBeenCalled();
  });

  it('rejects a quotation with no items', async () => {
    vi.mocked(salesOrdersRepository.listQuotationItemsForConversion).mockResolvedValue([]);
    vi.mocked(salesOrdersRepository.findQuotationForConversionForUpdate).mockResolvedValue(
      makeQuotation(),
    );

    await expect(salesOrdersService.convertFromQuotation('quote-1')).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});
