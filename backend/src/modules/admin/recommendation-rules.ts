import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface RecommendationRule {
  id: string;
  source_product_id: string;
  recommended_product_id: string;
  recommendation_type: 'UPSELL' | 'CROSS_SELL';
  priority: number;
  reason: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

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

const COLUMNS = [
  'source_product_id',
  'recommended_product_id',
  'recommendation_type',
  'priority',
  'reason',
  'status',
] as const;

const repository = createCrudRepository<RecommendationRule>({
  table: 'recommendation_rules',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Recommendation rule',
  entityType: 'recommendation_rule',
});

const controller = createCrudController(service, 'Recommendation rule');

export const recommendationRulesRouter = createCrudRouter({
  controller,
  createSchema: createRecommendationRuleSchema,
  updateSchema: updateRecommendationRuleSchema,
});
