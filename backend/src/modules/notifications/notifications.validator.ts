import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
