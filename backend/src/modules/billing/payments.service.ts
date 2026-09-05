import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { insertAuditLog } from '../../shared/auditLog';
import { billingRepository } from './billing.repository';
import { paymentsRepository } from './payments.repository';
import { Payment } from './payments.model';
import { Invoice } from './billing.model';

interface RecordPaymentDto {
  amount: number;
  paymentMethod: string;
  transactionReference?: string | null;
}

/**
 * No payment gateway is wired up (out of scope for this hackathon build) —
 * every recorded payment is treated as an immediate SUCCESS. Swap this for
 * a real gateway webhook/status flow before this ever handles real money.
 */
export const paymentsService = {
  async recordPayment(
    invoiceId: string,
    dto: RecordPaymentDto,
    actorId: string | null = null,
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0 || roundMoney(dto.amount) !== dto.amount) {
      throw Errors.businessRuleViolation(
        'Payment must be a positive amount with at most two decimal places',
      );
    }
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) throw Errors.notFound('Invoice');
    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      throw Errors.businessRuleViolation(
        `Cannot record a payment on an invoice in status ${invoice.status}`,
      );
    }

    return withTransaction(async (client) => {
      const locked = await billingRepository.findInvoiceByIdForUpdate(client, invoiceId);
      if (!locked) throw Errors.notFound('Invoice');
      // Another request may have completed while we waited for the lock.
      if (locked.status === 'PAID' || locked.status === 'VOID') {
        throw Errors.businessRuleViolation(
          `Cannot record a payment on an invoice in status ${locked.status}`,
        );
      }
      const alreadyPaid = roundMoney(
        await paymentsRepository.sumSuccessfulForInvoice(client, invoiceId),
      );
      const invoiceTotal = Number(locked.total);
      const remaining = roundMoney(invoiceTotal - alreadyPaid);
      if (dto.amount > remaining) {
        throw Errors.businessRuleViolation('Payment exceeds the remaining invoice balance');
      }

      const payment = await paymentsRepository.insert(client, {
        invoiceId,
        customerId: locked.customer_id,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        transactionReference: dto.transactionReference ?? null,
      });

      const totalPaid = roundMoney(alreadyPaid + dto.amount);
      const status = totalPaid >= invoiceTotal ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await billingRepository.updateInvoiceAfterPayment(
        client,
        invoiceId,
        status,
        status === 'PAID',
      );

      await insertAuditLog(client, {
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'PAYMENT_RECORDED',
        actorId,
        oldValue: { status: locked.status },
        newValue: { status, amount: dto.amount },
      });

      return { payment, invoice: updatedInvoice };
    });
  },

  async listForInvoice(invoiceId: string): Promise<Payment[]> {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) throw Errors.notFound('Invoice');
    return paymentsRepository.listForInvoice(invoiceId);
  },
};
