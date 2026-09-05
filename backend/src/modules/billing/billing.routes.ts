import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { billingController } from './billing.controller';
import {
  generateBillingSchema,
  idParamSchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
} from './billing.validator';

const BILLING_ROLES = ['FINANCE', 'SALES_MANAGER', 'ADMIN'];

// Mounted at /api/v1/sales-orders — generate the invoice/subscription split.
const salesOrderBillingRouter = Router();
salesOrderBillingRouter.use(authenticate, requireRole(...BILLING_ROLES));
salesOrderBillingRouter.post(
  '/:id/billing',
  validate({ params: idParamSchema, body: generateBillingSchema }),
  billingController.generate
);

// Mounted at /api/v1/invoices — read invoices and record payments against them.
const invoicesRouter = Router();
invoicesRouter.use(authenticate, requireRole(...BILLING_ROLES));
invoicesRouter.get('/', validate({ query: listInvoicesQuerySchema }), billingController.listInvoices);
invoicesRouter.get('/:id', validate({ params: idParamSchema }), billingController.getInvoiceById);
invoicesRouter.get('/:id/payments', validate({ params: idParamSchema }), billingController.listPayments);
invoicesRouter.post(
  '/:id/payments',
  validate({ params: idParamSchema, body: recordPaymentSchema }),
  billingController.recordPayment
);

export { salesOrderBillingRouter, invoicesRouter };
