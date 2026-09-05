import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const listNegotiationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const counterOfferChangeSchema = z.object({
  quotation_item_id: z.string().uuid(),
  new_discount_percent: z.number().min(0).max(100),
});

export const addMessageSchema = z
  .object({
    message: z.string().min(1).max(4000),
    message_type: z.enum(['TEXT', 'COUNTER_OFFER']).default('TEXT'),
    changes: z.array(counterOfferChangeSchema).optional(),
  })
  .refine(
    (data) => data.message_type !== 'COUNTER_OFFER' || (data.changes && data.changes.length > 0),
    {
      message: 'changes is required and must be non-empty when message_type is COUNTER_OFFER',
      path: ['changes'],
    },
  );
