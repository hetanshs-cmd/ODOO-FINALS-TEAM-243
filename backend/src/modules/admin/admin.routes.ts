import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { productCategoriesRouter } from './product-categories';
import { productsRouter } from './products';
import { priceListsRouter } from './price-lists';
import { customersRouter } from './customers';
import { customerTiersRouter } from './customer-tiers';
import { discountRulesRouter } from './discount-rules';
import { approvalLevelsRouter } from './approval-levels';
import { warehousesRouter } from './warehouses';
import { subscriptionPlansRouter } from './subscription-plans';
import { recommendationRulesRouter } from './recommendation-rules';

/**
 * Admin Module Router
 *
 * Mounts every admin config resource under /api/v1/admin/*. Each resource is
 * a thin instantiation of the shared generic CRUD factory (src/shared/crud) —
 * see docs/references.md (Strapi: one generic CRUD shape reused across
 * resources) — so each resource is one flat file (model + validator + a few
 * lines of wiring), not a new controller/service.
 *
 * All routes require an authenticated internal user with the ADMIN role.
 */
const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.use('/product-categories', productCategoriesRouter);
router.use('/products', productsRouter);
router.use('/price-lists', priceListsRouter);
router.use('/customers', customersRouter);
router.use('/customer-tiers', customerTiersRouter);
router.use('/discount-rules', discountRulesRouter);
router.use('/approval-levels', approvalLevelsRouter);
router.use('/warehouses', warehousesRouter);
router.use('/subscription-plans', subscriptionPlansRouter);
router.use('/recommendation-rules', recommendationRulesRouter);

export { router as adminRouter };
