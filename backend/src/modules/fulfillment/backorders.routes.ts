import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { backordersController } from './backorders.controller';
import { idParamSchema, listBackordersQuerySchema } from './backorders.validator';

// Mounted at /api/v1/backorders.
const router = Router();
router.use(authenticate, requireRole('OPERATIONS', 'SALES_MANAGER', 'ADMIN'));

router.get('/', validate({ query: listBackordersQuerySchema }), backordersController.list);
router.post(
  '/:id/consolidate',
  validate({ params: idParamSchema }),
  backordersController.consolidate,
);

export { router as backordersRouter };
