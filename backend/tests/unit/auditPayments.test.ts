import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingRepository } from '../../src/modules/billing/billing.repository';
import { paymentsRepository } from '../../src/modules/billing/payments.repository';
import { paymentsService } from '../../src/modules/billing/payments.service';

vi.mock('../../src/modules/billing/billing.repository');
vi.mock('../../src/modules/billing/payments.repository');
vi.mock('../../src/shared/auditLog');
vi.mock('../../src/shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn({}),
}));

describe('audit: payments use the locked balance', () => {
  const invoice = { id: 'inv-1', customer_id: 'customer-1', status: 'ISSUED', total: '100.00' };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(billingRepository.findInvoiceById).mockResolvedValue(invoice as never);
    vi.mocked(billingRepository.findInvoiceByIdForUpdate).mockResolvedValue(invoice as never);
    vi.mocked(paymentsRepository.sumSuccessfulForInvoice).mockResolvedValue(0);
  });

  it.each(['PAID', 'VOID'])(
    'rejects a stale request when the locked invoice is %s',
    async (status) => {
      vi.mocked(billingRepository.findInvoiceByIdForUpdate).mockResolvedValue({
        ...invoice,
        status,
      } as never);
      await expect(
        paymentsService.recordPayment('inv-1', { amount: 100, paymentMethod: 'TEST' }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(paymentsRepository.insert).not.toHaveBeenCalled();
    },
  );

  it('rejects payment above the remaining balance', async () => {
    vi.mocked(paymentsRepository.sumSuccessfulForInvoice).mockResolvedValue(60);
    await expect(
      paymentsService.recordPayment('inv-1', { amount: 50, paymentMethod: 'TEST' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(paymentsRepository.insert).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity, 0.001, 1.234])(
    'rejects invalid money %s without writes',
    async (amount) => {
      await expect(
        paymentsService.recordPayment('inv-1', { amount, paymentMethod: 'TEST' }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(paymentsRepository.insert).not.toHaveBeenCalled();
    },
  );

  it('records the exact remaining balance and marks the invoice paid', async () => {
    vi.mocked(paymentsRepository.sumSuccessfulForInvoice).mockResolvedValue(60);
    await paymentsService.recordPayment('inv-1', { amount: 40, paymentMethod: 'TEST' });
    expect(paymentsRepository.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 40 }),
    );
    expect(billingRepository.updateInvoiceAfterPayment).toHaveBeenCalledWith(
      expect.anything(),
      'inv-1',
      'PAID',
      true,
    );
  });
});
