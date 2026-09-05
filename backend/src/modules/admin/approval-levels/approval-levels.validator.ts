import { z } from 'zod';

export const createApprovalLevelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  level: z.coerce.number().int().min(1),
  description: z.string().max(2000).optional().nullable(),
});

export const updateApprovalLevelSchema = createApprovalLevelSchema.partial();
