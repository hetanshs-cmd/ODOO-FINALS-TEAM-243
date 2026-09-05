import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  // DB also enforces parent_category_id <> id (a category can't parent itself).
  parent_category_id: z.string().uuid().optional().nullable(),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

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
