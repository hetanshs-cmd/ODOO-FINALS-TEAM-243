import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { PriceList } from './price-lists.model';
import { createPriceListSchema, updatePriceListSchema } from './price-lists.validator';

const COLUMNS = ['name', 'currency', 'customer_tier_id', 'valid_from', 'valid_until', 'status'] as const;

const repository = createCrudRepository<PriceList>({ table: 'price_lists', columns: COLUMNS });

const service = createCrudService(repository, {
  resourceName: 'Price list',
  entityType: 'price_list',
});

const controller = createCrudController(service, 'Price list');

export const priceListsRouter = createCrudRouter({
  controller,
  createSchema: createPriceListSchema,
  updateSchema: updatePriceListSchema,
});
