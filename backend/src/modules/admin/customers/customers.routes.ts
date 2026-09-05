import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../../shared/crud';
import { Customer } from './customers.model';
import { createCustomerSchema, updateCustomerSchema } from './customers.validator';

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
