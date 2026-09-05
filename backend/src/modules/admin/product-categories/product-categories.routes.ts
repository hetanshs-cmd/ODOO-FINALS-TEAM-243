import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { ProductCategory } from './product-categories.model';
import { createProductCategorySchema, updateProductCategorySchema } from './product-categories.validator';

const COLUMNS = ['name', 'description', 'parent_category_id'] as const;

const repository = createCrudRepository<ProductCategory>({
  table: 'product_categories',
  columns: COLUMNS,
});

const service = createCrudService(repository, {
  resourceName: 'Product category',
  entityType: 'product_category',
});

const controller = createCrudController(service, 'Product category');

export const productCategoriesRouter = createCrudRouter({
  controller,
  createSchema: createProductCategorySchema,
  updateSchema: updateProductCategorySchema,
});
