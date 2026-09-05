import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

/**
 * PATCH /subscriptions/:id
 *
 * At least one of plan_id/quantity must be given — an empty body is
 * rejected rather than silently no-op'ing. See subscriptions.service.ts for
 * how the two combine into a new current_price.
 */
export const modifySubscriptionSchema = z
  .object({
    plan_id: z.string().uuid('plan_id must be a valid UUID').optional(),
    quantity: z.coerce.number().positive('quantity must be greater than 0').optional(),
  })
  .refine((data) => data.plan_id !== undefined || data.quantity !== undefined, {
    message: 'At least one of plan_id or quantity is required',
  });
