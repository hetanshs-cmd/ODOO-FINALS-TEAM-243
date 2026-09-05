import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { CustomerTier } from './customer-tiers.model';
import { createCustomerTierSchema, updateCustomerTierSchema } from './customer-tiers.validator';

const COLUMNS = ['name', 'description', 'discount_limit', 'priority', 'status'] as const;

const repository = createCrudRepository<CustomerTier>({ table: 'customer_tiers', columns: COLUMNS });

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
