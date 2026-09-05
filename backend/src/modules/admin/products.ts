import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string;
  product_type: 'ONE_TIME' | 'RECURRING';
  base_price: string;
  cost_price: string | null;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  created_at: string;
  updated_at: string;
}

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category_id: z.string().uuid(),
  product_type: z.enum(['ONE_TIME', 'RECURRING']),
  base_price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().trim().min(1).max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
});

export const updateProductSchema = createProductSchema.partial();

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
