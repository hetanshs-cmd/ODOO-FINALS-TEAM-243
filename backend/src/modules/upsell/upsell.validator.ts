import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const recommendationsQuerySchema = z.object({
  type: z.enum(['UPSELL', 'CROSS_SELL']).optional(),
  min_margin_percent: z.coerce.number().min(0).max(100).optional(),
});
