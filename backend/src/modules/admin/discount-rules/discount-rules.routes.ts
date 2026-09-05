import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { DiscountRule } from './discount-rules.model';
import { createDiscountRuleSchema, updateDiscountRuleSchema } from './discount-rules.validator';

const COLUMNS = [
  'name',
  'priority',
  'product_id',
  'category_id',
  'customer_tier_id',
  'sales_role',
  'min_discount',
  'max_discount',
  'approval_required',
  'approval_level',
  'active',
] as const;

const repository = createCrudRepository<DiscountRule>({ table: 'discount_rules', columns: COLUMNS });

const service = createCrudService(repository, {
  resourceName: 'Discount rule',
  entityType: 'discount_rule',
});

const controller = createCrudController(service, 'Discount rule');

export const discountRulesRouter = createCrudRouter({
  controller,
  createSchema: createDiscountRuleSchema,
  updateSchema: updateDiscountRuleSchema,
});
