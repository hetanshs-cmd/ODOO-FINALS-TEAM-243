import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  billing_frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price: string;
  trial_days: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  billing_frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  price: z.coerce.number().min(0),
  trial_days: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();

const COLUMNS = [
  'name',
  'description',
  'billing_frequency',
  'price',
  'trial_days',
  'status',
] as const;

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
