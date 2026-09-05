import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { productsController } from './products.controller';

// Read-only product directory for every internal role — distinct from the
// ADMIN-only /admin/products CRUD, which stays the place to manage them.
// Mounted at /api/v1/products alongside upsellRouter (see app.ts); the
// broader role gate here is a superset of upsellRouter's, so this router
// never blocks a request meant for it (see docs/CODEBASE_AUDIT.md Finding 1
// on router-mounting order).
const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'ADMIN'));
router.get('/', productsController.list);

export { router as productsRouter };
