import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const listCreditNotesQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'VOIDED']).optional(),
  customer_id: z.string().uuid().optional(),
  subscription_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const updateCreditNoteStatusSchema = z.object({
  status: z.enum(['APPLIED', 'VOIDED']),
});
