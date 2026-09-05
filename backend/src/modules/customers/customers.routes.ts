import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { customersController } from './customers.controller';
import { listCustomersQuerySchema } from './customers.validator';

// Read-only customer directory for the sales org — distinct from the
// ADMIN-only /admin/customers CRUD, which stays the place to manage them.
const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'));
router.get('/', validate({ query: listCustomersQuerySchema }), customersController.list);

export { router as customersRouter };
