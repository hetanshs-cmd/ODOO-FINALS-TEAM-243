import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { SubscriptionPlan } from './subscription-plans.model';
import { createSubscriptionPlanSchema, updateSubscriptionPlanSchema } from './subscription-plans.validator';

const COLUMNS = ['name', 'description', 'billing_frequency', 'price', 'trial_days', 'status'] as const;

const repository = createCrudRepository<SubscriptionPlan>({
  table: 'subscription_plans',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Subscription plan',
  entityType: 'subscription_plan',
});

const controller = createCrudController(service, 'Subscription plan');

export const subscriptionPlansRouter = createCrudRouter({
  controller,
  createSchema: createSubscriptionPlanSchema,
  updateSchema: updateSubscriptionPlanSchema,
});
