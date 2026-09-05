import { z } from 'zod';

export const createCustomerSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  customer_code: z.string().trim().min(1).max(50),
  customer_tier_id: z.string().uuid(),
  industry: z.string().max(100).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  website: z.string().url().max(255).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
