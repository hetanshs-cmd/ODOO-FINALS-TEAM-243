import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  customer_tier_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  created_at: string;
  updated_at: string;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format');

export const createPriceListSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    currency: z.string().trim().length(3).toUpperCase(),
    customer_tier_id: z.string().uuid().optional().nullable(),
    valid_from: dateOnly,
    valid_until: dateOnly.optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  })
  .refine((data) => !data.valid_until || data.valid_until >= data.valid_from, {
    message: 'valid_until must be on or after valid_from',
    path: ['valid_until'],
  });

// Partial update: cross-field valid_from/valid_until ordering is still
// enforced by the DB CHECK constraint (chk_price_lists_valid_range) since a
// partial update may only touch one side of the range.
export const updatePriceListSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  customer_tier_id: z.string().uuid().optional().nullable(),
  valid_from: dateOnly.optional(),
  valid_until: dateOnly.optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
});

const COLUMNS = [
  'name',
  'currency',
  'customer_tier_id',
  'valid_from',
  'valid_until',
  'status',
] as const;

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
