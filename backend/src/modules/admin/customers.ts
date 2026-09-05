import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface Customer {
  id: string;
  company_name: string;
  customer_code: string;
  customer_tier_id: string;
  industry: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
}

export const createCustomerSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  customer_code: z.string().trim().min(1).max(50),
  customer_tier_id: z.string().uuid(),
  industry: z.string().max(100).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  website: z.string().url().max(255).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

const COLUMNS = [
  'company_name',
  'customer_code',
  'customer_tier_id',
  'industry',
  'tax_id',
  'email',
  'phone',
  'website',
  'status',
] as const;

const repository = createCrudRepository<Customer>({ table: 'customers', columns: COLUMNS });

const service = createCrudService(repository, {
  resourceName: 'Customer',
  entityType: 'customer',
});

const controller = createCrudController(service, 'Customer');

export const customersRouter = createCrudRouter({
  controller,
  createSchema: createCustomerSchema,
  updateSchema: updateCustomerSchema,
});
