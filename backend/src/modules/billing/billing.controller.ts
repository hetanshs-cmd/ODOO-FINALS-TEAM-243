import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { billingService } from './billing.service';
import { paymentsService } from './payments.service';

export const billingController = {
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { plan_id } = req.body as { plan_id?: string };
      const result = await billingService.generateBillingForOrder(
        req.params['id'] as string,
        plan_id,
        req.user?.id ?? null,
      );
      sendCreated({ res, data: result, message: 'Billing generated for sales order' });
    } catch (err) {
      next(err);
    }
  },

  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await billingService.listInvoices(
        req.query as { status?: string; customer_id?: string }
      );
      sendSuccess({ res, data: result, message: 'Invoices retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await billingService.getInvoiceDetail(req.params['id'] as string);
      sendSuccess({ res, data: invoice, message: 'Invoice retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, payment_method, transaction_reference } = req.body as {
        amount: number;
        payment_method: string;
        transaction_reference?: string;
      };
      const result = await paymentsService.recordPayment(
        req.params['id'] as string,
        {
          amount,
          paymentMethod: payment_method,
          transactionReference: transaction_reference,
        },
        req.user?.id ?? null,
      );
      sendCreated({ res, data: result, message: 'Payment recorded successfully' });
    } catch (err) {
      next(err);
    }
  },

  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payments = await paymentsService.listForInvoice(req.params['id'] as string);
      sendSuccess({ res, data: payments, message: 'Payments retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
