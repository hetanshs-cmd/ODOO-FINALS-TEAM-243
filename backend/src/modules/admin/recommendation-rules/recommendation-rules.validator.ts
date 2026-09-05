import { z } from 'zod';

export const createRecommendationRuleSchema = z
  .object({
    source_product_id: z.string().uuid(),
    recommended_product_id: z.string().uuid(),
    recommendation_type: z.enum(['UPSELL', 'CROSS_SELL']),
    priority: z.coerce.number().int().min(0).optional(),
    reason: z.string().max(2000).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((data) => data.source_product_id !== data.recommended_product_id, {
    message: 'source_product_id and recommended_product_id must differ',
    path: ['recommended_product_id'],
  });

// Partial update: the source<>recommended distinctness check is re-verified
// by the DB CHECK constraint (chk_recommendation_rules_not_self) when both
// sides end up equal after a partial update.
export const updateRecommendationRuleSchema = z.object({
  source_product_id: z.string().uuid().optional(),
  recommended_product_id: z.string().uuid().optional(),
  recommendation_type: z.enum(['UPSELL', 'CROSS_SELL']).optional(),
  priority: z.coerce.number().int().min(0).optional(),
  reason: z.string().max(2000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
