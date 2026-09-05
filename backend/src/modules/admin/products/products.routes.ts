import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { Product } from './products.model';
import { createProductSchema, updateProductSchema } from './products.validator';

const COLUMNS = [
  'sku',
  'name',
  'description',
  'category_id',
  'product_type',
  'base_price',
  'cost_price',
  'unit',
  'status',
] as const;

const repository = createCrudRepository<Product>({ table: 'products', columns: COLUMNS });

const service = createCrudService(repository, {
  resourceName: 'Product',
  entityType: 'product',
});

const controller = createCrudController(service, 'Product');

export const productsRouter = createCrudRouter({
  controller,
  createSchema: createProductSchema,
  updateSchema: updateProductSchema,
});
