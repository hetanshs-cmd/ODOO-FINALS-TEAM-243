import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface CustomerTier {
  id: string;
  name: string;
  description: string | null;
  discount_limit: string;
  priority: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export const createCustomerTierSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().max(2000).optional().nullable(),
  discount_limit: z.coerce.number().min(0).max(100),
  priority: z.coerce.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateCustomerTierSchema = createCustomerTierSchema.partial();

const COLUMNS = ['name', 'description', 'discount_limit', 'priority', 'status'] as const;

const repository = createCrudRepository<CustomerTier>({
  table: 'customer_tiers',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Customer tier',
  entityType: 'customer_tier',
});

const controller = createCrudController(service, 'Customer tier');

export const customerTiersRouter = createCrudRouter({
  controller,
  createSchema: createCustomerTierSchema,
  updateSchema: updateCustomerTierSchema,
});
