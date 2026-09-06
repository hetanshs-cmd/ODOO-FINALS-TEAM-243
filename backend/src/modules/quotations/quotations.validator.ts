import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const itemIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  itemId: z.string().uuid('itemId must be a valid UUID'),
});

export const createQuotationSchema = z.object({
  customer_id: z.string().uuid(),
  title: z.string().trim().max(200).optional().nullable(),
  price_list_id: z.string().uuid().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
    .optional()
    .nullable(),
});

export const updateQuotationSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  price_list_id: z.string().uuid().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
    .optional()
    .nullable(),
  order_discount_percent: z.coerce.number().min(0).max(100).optional(),
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

// product_id/billing_type are intentionally excluded from what's editable —
// changing "what product this line is" isn't an edit, it's remove-and-re-add.
export const updateQuotationItemSchema = z.object({
  description: z.string().max(2000).optional().nullable(),
  quantity: z.coerce.number().positive().optional(),
  unit_price: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  tax_percent: z.coerce.number().min(0).max(100).optional(),
});
