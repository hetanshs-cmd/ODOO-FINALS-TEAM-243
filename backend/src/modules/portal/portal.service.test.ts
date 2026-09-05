import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portalRepository } from './portal.repository';
import { portalService } from './portal.service';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { salesOrdersService } from '../sales-orders/sales-orders.service';
import { Quotation } from '../quotations/quotations.model';

/**
 * Unit tests for confirmQuotation — the other half of the AUD-001 fix
 * (CODEBASE_AUDIT.md P0): this is the previously-missing producer of the
 * ACCEPTED status that POST /quotations/:id/convert requires. Covers the
 * "governance cannot be bypassed by clicking confirm" rule specifically,
 * since that's the one a naive implementation gets wrong.
 */
vi.mock('./portal.repository');
vi.mock('../discount-engine/discount-engine.service');
vi.mock('../sales-orders/sales-orders.service');

const FAKE_CLIENT = {} as never;

vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

vi.mock('../../shared/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quote-1',
    quotation_number: 'Q-1',
    customer_id: 'customer-1',
    sales_rep_id: 'rep-1',
    price_list_id: null,
    currency: 'USD',
    status: 'SUBMITTED',
    subtotal: '100.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '100.00',
    valid_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Quotation;
}

describe('portalService.confirmQuotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a quotation that does not belong to this customer (scoped read returns null)', async () => {
    vi.mocked(portalRepository.findQuotationForConfirmForUpdate).mockResolvedValue(null);

    await expect(
      portalService.confirmQuotation('quote-1', 'customer-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a quotation in a non-confirmable status', async () => {
    vi.mocked(portalRepository.findQuotationForConfirmForUpdate).mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );

    await expect(
      portalService.confirmQuotation('quote-1', 'customer-1'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('re-runs the discount engine for a SUBMITTED quotation before accepting', async () => {
    vi.mocked(portalRepository.findQuotationForConfirmForUpdate).mockResolvedValue(
      makeQuotation({ status: 'SUBMITTED' }),
    );
    vi.mocked(discountEngineService.checkDiscounts).mockResolvedValue({
      quotationId: 'quote-1',
      status: 'APPROVED',
      blendedScore: 0,
      riskLevel: 'LOW',
      evaluations: [],
      approvalRequestId: null,
    });
    vi.mocked(portalRepository.markQuotationAccepted).mockResolvedValue(
      makeQuotation({ status: 'ACCEPTED' }),
    );
    vi.mocked(salesOrdersService.convertFromQuotation).mockResolvedValue({
      id: 'so-1',
      items: [],
    } as never);

    const result = await portalService.confirmQuotation('quote-1', 'customer-1');

    expect(discountEngineService.checkDiscounts).toHaveBeenCalledWith('quote-1');
    expect(result.status).toBe('ACCEPTED');
    expect(result.salesOrder).toMatchObject({ id: 'so-1' });
  });

  it('does NOT bypass governance: a negotiated discount that still breaches the ceiling re-enters approval instead of being accepted', async () => {
    vi.mocked(portalRepository.findQuotationForConfirmForUpdate).mockResolvedValue(
      makeQuotation({ status: 'NEGOTIATION' }),
    );
    vi.mocked(discountEngineService.checkDiscounts).mockResolvedValue({
      quotationId: 'quote-1',
      status: 'PENDING_APPROVAL',
      blendedScore: 42,
      riskLevel: 'HIGH',
      evaluations: [],
      approvalRequestId: 'approval-1',
    });

    const result = await portalService.confirmQuotation('quote-1', 'customer-1');

    expect(result.status).toBe('PENDING_APPROVAL');
    expect(result.requiresApproval).toBe(true);
    expect(result.salesOrder).toBeNull();
    // Must not accept or convert a quotation that just re-entered approval.
    expect(portalRepository.markQuotationAccepted).not.toHaveBeenCalled();
    expect(salesOrdersService.convertFromQuotation).not.toHaveBeenCalled();
  });

  it('skips re-running the discount engine when the quotation is already APPROVED', async () => {
    vi.mocked(portalRepository.findQuotationForConfirmForUpdate).mockResolvedValue(
      makeQuotation({ status: 'APPROVED' }),
    );
    vi.mocked(portalRepository.markQuotationAccepted).mockResolvedValue(
      makeQuotation({ status: 'ACCEPTED' }),
    );
    vi.mocked(salesOrdersService.convertFromQuotation).mockResolvedValue({
      id: 'so-1',
      items: [],
    } as never);

    const result = await portalService.confirmQuotation('quote-1', 'customer-1');

    expect(discountEngineService.checkDiscounts).not.toHaveBeenCalled();
    expect(result.status).toBe('ACCEPTED');
  });
});
