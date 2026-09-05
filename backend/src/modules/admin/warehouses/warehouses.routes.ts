import { createCrudController, createCrudRepository, createCrudRouter, createCrudService } from '../../../shared/crud';
import { Warehouse } from './warehouses.model';
import { createWarehouseSchema, updateWarehouseSchema } from './warehouses.validator';

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
