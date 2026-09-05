import { z } from 'zod';

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  billing_frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  price: z.coerce.number().min(0),
  trial_days: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();
