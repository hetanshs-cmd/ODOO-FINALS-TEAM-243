import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portalRepository } from './portal.repository';
import { portalService } from './portal.service';

/**
 * The tenant-isolation guarantee here lives in the repository's SQL
 * (`WHERE id = $1 AND customer_id = $2`) — a customer_id mismatch simply
 * returns no row, same as a genuinely missing id. This test verifies the
 * service surfaces that as 404 rather than assuming the repository always
 * filters correctly.
 */
vi.mock('./portal.repository');

describe('portalService tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getQuotation 404s when the quotation does not belong to this customer', async () => {
    vi.mocked(portalRepository.findQuotationForCustomer).mockResolvedValue(null);

    await expect(portalService.getQuotation('quote-1', 'customer-2')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(portalRepository.findQuotationForCustomer).toHaveBeenCalledWith('quote-1', 'customer-2');
  });

  it('getInvoice 404s when the invoice does not belong to this customer', async () => {
    vi.mocked(portalRepository.findInvoiceForCustomer).mockResolvedValue(null);

    await expect(portalService.getInvoice('invoice-1', 'customer-2')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(portalRepository.findInvoiceForCustomer).toHaveBeenCalledWith('invoice-1', 'customer-2');
  });

  it('listQuotations only queries scoped to the requesting customer', async () => {
    vi.mocked(portalRepository.listQuotationsForCustomer).mockResolvedValue([]);

    await portalService.listQuotations('customer-1');

    expect(portalRepository.listQuotationsForCustomer).toHaveBeenCalledWith('customer-1');
  });
});
