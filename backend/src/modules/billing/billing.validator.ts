import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const generateBillingSchema = z.object({
  plan_id: z.string().uuid('plan_id must be a valid UUID').optional(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID']).optional(),
  customer_id: z.string().uuid().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().finite().positive('amount must be greater than 0').multipleOf(0.01),
  payment_method: z.string().min(1).max(30),
  transaction_reference: z.string().max(100).optional(),
});
