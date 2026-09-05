import { z } from 'zod';

// Scope fields (product_id/category_id/customer_tier_id) are all optional —
// a rule may be scoped at any single level, or be global when all three are
// omitted. See database/schema/er-diagram.md § Discount Engine.
const scopeFields = {
  product_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  customer_tier_id: z.string().uuid().optional().nullable(),
  sales_role: z.string().trim().max(50).optional().nullable(),
};

export const createDiscountRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    priority: z.coerce.number().int().min(0).optional(),
    ...scopeFields,
    min_discount: z.coerce.number().min(0).max(100),
    max_discount: z.coerce.number().min(0).max(100),
    approval_required: z.coerce.boolean().optional(),
    approval_level: z.coerce.number().int().optional().nullable(),
    active: z.coerce.boolean().optional(),
  })
  .refine((data) => data.max_discount >= data.min_discount, {
    message: 'max_discount must be >= min_discount',
    path: ['max_discount'],
  });

// Partial update: min/max ordering across a partial update is still enforced
// by the DB CHECK constraint (chk_discount_rules_range).
export const updateDiscountRuleSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  priority: z.coerce.number().int().min(0).optional(),
  ...scopeFields,
  min_discount: z.coerce.number().min(0).max(100).optional(),
  max_discount: z.coerce.number().min(0).max(100).optional(),
  approval_required: z.coerce.boolean().optional(),
  approval_level: z.coerce.number().int().optional().nullable(),
  active: z.coerce.boolean().optional(),
});
