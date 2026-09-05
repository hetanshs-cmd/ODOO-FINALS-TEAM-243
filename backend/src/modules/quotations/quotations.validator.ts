import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const createQuotationSchema = z.object({
  customer_id: z.string().uuid(),
  price_list_id: z.string().uuid().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

export const updateQuotationSchema = z.object({
  price_list_id: z.string().uuid().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

export const listQuotationsQuerySchema = z.object({
  status: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const createQuotationItemSchema = z.object({
  product_id: z.string().uuid(),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  tax_percent: z.coerce.number().min(0).max(100).optional(),
  billing_type: z.enum(['ONE_TIME', 'RECURRING']),
});
