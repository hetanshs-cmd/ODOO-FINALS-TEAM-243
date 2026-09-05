import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const alertIdParamSchema = z.object({
  alertId: z.string().uuid('alertId must be a valid UUID'),
});

export const listAlertsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const updateAlertStatusSchema = z.object({
  status: z.enum(['ESCALATED', 'NUDGED', 'RESOLVED']),
});
