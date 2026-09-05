import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingRepository as repo } from '../../src/modules/billing/billing.repository';
import { billingService } from '../../src/modules/billing/billing.service';

vi.mock('../../src/modules/billing/billing.repository');
vi.mock('../../src/shared/auditLog');
vi.mock('../../src/shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn({}),
}));

describe('audit: initial order billing safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const order = {
      id: 'order',
      quotation_id: 'quote',
      customer_id: 'customer',
      status: 'FULFILLED',
    };
    vi.mocked(repo.findSalesOrderForBilling).mockResolvedValue(order);
    vi.mocked(repo.lockOrderForBilling).mockResolvedValue(order);
    vi.mocked(repo.hasBillingForOrder).mockResolvedValue(false);
    vi.mocked(repo.hasUnshippedOneTimeItems).mockResolvedValue(false);
    vi.mocked(repo.listQuotationItemsWithProduct).mockResolvedValue([
      {
        id: 'item',
        product_id: 'goods',
        product_name: 'Goods',
        quantity: '10',
        unit_price: '100',
        discount_amount: '100',
        tax_percent: '10',
        line_total: '990',
        billing_type: 'ONE_TIME',
      },
    ]);
    vi.mocked(repo.insertInvoice).mockResolvedValue({ id: 'invoice' } as never);
  });

  it('does not write any billing records when goods remain unshipped', async () => {
    vi.mocked(repo.hasUnshippedOneTimeItems).mockResolvedValue(true);
    await expect(billingService.generateBillingForOrder('order')).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(repo.insertInvoice).not.toHaveBeenCalled();
    expect(repo.insertSubscription).not.toHaveBeenCalled();
  });

  it('rejects duplicate billing under the order lock', async () => {
    vi.mocked(repo.hasBillingForOrder).mockResolvedValue(true);
    await expect(billingService.generateBillingForOrder('order')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });

  it('rejects cancelled orders', async () => {
    vi.mocked(repo.lockOrderForBilling).mockResolvedValue({ status: 'CANCELLED' } as never);
    await expect(billingService.generateBillingForOrder('order')).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(repo.insertInvoice).not.toHaveBeenCalled();
  });

  it('preserves tax-inclusive total and reports net subtotal and tax once', async () => {
    await billingService.generateBillingForOrder('order');
    expect(repo.insertInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subtotal: 900, taxTotal: 90, total: 990 }),
    );
    expect(repo.insertInvoiceItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tax: 90, total: '990', quantity: '10' }),
    );
  });
});
