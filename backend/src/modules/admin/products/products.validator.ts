import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category_id: z.string().uuid(),
  product_type: z.enum(['ONE_TIME', 'RECURRING']),
  base_price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().trim().min(1).max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
});

export const updateProductSchema = createProductSchema.partial();
