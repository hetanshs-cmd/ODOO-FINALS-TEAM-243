import { z } from 'zod';
import {
  createCrudController,
  createCrudRepository,
  createCrudRouter,
  createCrudService,
} from '../../shared/crud';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address_id: string | null;
  manager_id: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(1).max(50),
  address_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

const COLUMNS = ['name', 'code', 'address_id', 'manager_id', 'status'] as const;

const repository = createCrudRepository<Warehouse>({ table: 'warehouses', columns: COLUMNS });

const service = createCrudService(repository, {
  resourceName: 'Warehouse',
  entityType: 'warehouse',
});

const controller = createCrudController(service, 'Warehouse');

export const warehousesRouter = createCrudRouter({
  controller,
  createSchema: createWarehouseSchema,
  updateSchema: updateWarehouseSchema,
});
