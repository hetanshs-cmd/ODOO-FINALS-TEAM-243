import { Router } from 'express';
import { z, ZodSchema } from 'zod';
import { validate } from '../../middleware/validate';
import { CrudController } from './crudController';

const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export interface CrudRouterConfig {
  controller: CrudController;
  createSchema: ZodSchema;
  updateSchema: ZodSchema;
}

/**
 * Generic Router Factory
 *
 * Wires the standard five REST verbs (list/get/create/update/delete) for one
 * resource, using its own create/update Zod schemas. This is the single
 * route shape every /admin/* resource shares.
 */
export function createCrudRouter({ controller, createSchema, updateSchema }: CrudRouterConfig): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:id', validate({ params: idParamSchema }), controller.getById);
  router.post('/', validate({ body: createSchema }), controller.create);
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateSchema }),
    controller.update
  );
  router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

  return router;
}
