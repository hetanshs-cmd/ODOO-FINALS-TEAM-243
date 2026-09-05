import { z } from 'zod';

export const createCustomerTierSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().max(2000).optional().nullable(),
  discount_limit: z.coerce.number().min(0).max(100),
  priority: z.coerce.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateCustomerTierSchema = createCustomerTierSchema.partial();
