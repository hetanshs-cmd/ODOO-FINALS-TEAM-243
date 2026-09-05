import { z } from 'zod';

export const salesSummaryQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const discountExceptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
