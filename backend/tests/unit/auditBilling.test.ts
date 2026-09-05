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
    // invoices/invoice_items store no totals (015_billing_invoices.sql) —
    // billingService reads them back from invoice_totals after inserting items.
    vi.mocked(repo.findInvoiceTotals).mockResolvedValue({
      subtotal: '900.00',
      tax_total: '90.00',
      total: '990.00',
    });
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
    const result = await billingService.generateBillingForOrder('order');

    // Discount is netted into invoice_items.unit_price (invoice_items has no
    // discount column — 015_billing_invoices.sql): 10 * 100 - 100 discount =
    // 900 net, / 10 units = 90/unit; tax_percent carries over unchanged.
    expect(repo.insertInvoiceItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ unitPrice: '90', taxPercent: '10', quantity: '10' }),
    );
    expect(result.invoice).toMatchObject({ subtotal: '900.00', tax_total: '90.00', total: '990.00' });
  });
});
