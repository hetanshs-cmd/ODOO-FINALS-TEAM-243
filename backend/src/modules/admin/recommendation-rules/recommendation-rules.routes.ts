import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { RecommendationRule } from './recommendation-rules.model';
import {
  createRecommendationRuleSchema,
  updateRecommendationRuleSchema,
} from './recommendation-rules.validator';

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
