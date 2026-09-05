import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quotationsRepository } from './quotations.repository';
import { quotationsService } from './quotations.service';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { dealHealthService } from '../deal-health/deal-health.service';
import { Quotation, QuotationItem } from './quotations.model';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * Unit tests for the quotations service — repository and the two
 * cross-module services it auto-invokes (discount-engine, deal-health) are
 * mocked, per this codebase's "mock repositories/collaborators" convention
 * (see subscriptions.test.ts for the same pattern).
 */
vi.mock('./quotations.repository');
vi.mock('../discount-engine/discount-engine.service');
vi.mock('../deal-health/deal-health.service');

const FAKE_CLIENT = {} as never;
vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

const SALES_REP: AuthenticatedUser = { id: 'rep-1', role: 'SALES_REP' } as AuthenticatedUser;

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quote-1',
    quotation_number: 'Q-0001',
    customer_id: 'customer-1',
    sales_rep_id: 'rep-1',
    price_list_id: null,
    status: 'DRAFT',
    currency: 'USD',
    subtotal: '100.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '100.00',
    valid_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: 'item-1',
    quotation_id: 'quote-1',
    product_id: 'product-1',
    description: null,
    quantity: '1',
    unit_price: '100.00',
    discount_percent: '0',
    discount_amount: '0.00',
    tax_percent: '0',
    line_total: '100.00',
    billing_type: 'ONE_TIME',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('quotationsService.submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown quotation', async () => {
    vi.mocked(quotationsRepository.findById).mockResolvedValue(null);

    await expect(quotationsService.submit('missing', SALES_REP)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects a quotation not owned by a plain sales rep', async () => {
    vi.mocked(quotationsRepository.findById).mockResolvedValue(
      makeQuotation({ sales_rep_id: 'someone-else' }),
    );

    await expect(quotationsService.submit('quote-1', SALES_REP)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects submitting a non-DRAFT quotation', async () => {
    vi.mocked(quotationsRepository.findById).mockResolvedValue(
      makeQuotation({ status: 'SUBMITTED' }),
    );

    await expect(quotationsService.submit('quote-1', SALES_REP)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects submitting a quotation with no items', async () => {
    vi.mocked(quotationsRepository.findById).mockResolvedValue(makeQuotation());
    vi.mocked(quotationsRepository.listItems).mockResolvedValue([]);

    await expect(quotationsService.submit('quote-1', SALES_REP)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('transitions DRAFT -> SUBMITTED and auto-invokes the discount engine', async () => {
    vi.mocked(quotationsRepository.findById)
      .mockResolvedValueOnce(makeQuotation({ status: 'DRAFT' }))
      .mockResolvedValueOnce(makeQuotation({ status: 'PENDING_APPROVAL' }));
    vi.mocked(quotationsRepository.listItems).mockResolvedValue([makeItem()]);
    vi.mocked(quotationsRepository.updateStatus).mockResolvedValue(
      makeQuotation({ status: 'SUBMITTED' }),
    );
    vi.mocked(discountEngineService.checkDiscounts).mockResolvedValue({
      quotationId: 'quote-1',
      status: 'PENDING_APPROVAL',
      blendedScore: 40,
      riskLevel: 'HIGH',
      evaluations: [],
      approvalRequestId: 'approval-1',
    });

    const result = await quotationsService.submit('quote-1', SALES_REP);

    expect(quotationsRepository.updateStatus).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'quote-1',
      'SUBMITTED',
    );
    // checkDiscounts (which itself refreshes deal-health) is the single
    // source of truth for post-submit governance — no duplicate recalculate
    // call from this service.
    expect(discountEngineService.checkDiscounts).toHaveBeenCalledWith('quote-1');
    expect(result.status).toBe('PENDING_APPROVAL');
  });
});

describe('quotationsService.addItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the deal-health score after adding a line item', async () => {
    vi.mocked(quotationsRepository.findById).mockResolvedValue(makeQuotation());
    vi.mocked(quotationsRepository.addItem).mockResolvedValue(makeItem());
    vi.mocked(quotationsRepository.recalculateTotals).mockResolvedValue(makeQuotation());

    await quotationsService.addItem(
      'quote-1',
      {
        product_id: 'product-1',
        quantity: 1,
        unit_price: 100,
        billing_type: 'ONE_TIME',
      },
      SALES_REP,
    );

    expect(dealHealthService.recalculate).toHaveBeenCalledWith('quote-1');
  });
});
