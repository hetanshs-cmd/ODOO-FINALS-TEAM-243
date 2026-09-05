import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format');

export const createPriceListSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    currency: z.string().trim().length(3).toUpperCase(),
    customer_tier_id: z.string().uuid().optional().nullable(),
    valid_from: dateOnly,
    valid_until: dateOnly.optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  })
  .refine(
    (data) => !data.valid_until || data.valid_until >= data.valid_from,
    { message: 'valid_until must be on or after valid_from', path: ['valid_until'] }
  );

// Partial update: cross-field valid_from/valid_until ordering is still
// enforced by the DB CHECK constraint (chk_price_lists_valid_range) since a
// partial update may only touch one side of the range.
export const updatePriceListSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  customer_tier_id: z.string().uuid().optional().nullable(),
  valid_from: dateOnly.optional(),
  valid_until: dateOnly.optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
});
