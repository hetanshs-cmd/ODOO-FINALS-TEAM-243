import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { productCategoriesRouter } from './product-categories/product-categories.routes';
import { productsRouter } from './products/products.routes';
import { priceListsRouter } from './price-lists/price-lists.routes';
import { customerTiersRouter } from './customer-tiers/customer-tiers.routes';
import { discountRulesRouter } from './discount-rules/discount-rules.routes';
import { approvalLevelsRouter } from './approval-levels/approval-levels.routes';
import { warehousesRouter } from './warehouses/warehouses.routes';
import { subscriptionPlansRouter } from './subscription-plans/subscription-plans.routes';
import { recommendationRulesRouter } from './recommendation-rules/recommendation-rules.routes';

/**
 * Admin Module Router
 *
 * Mounts every admin config resource under /api/v1/admin/*. Each resource is
 * a thin instantiation of the shared generic CRUD factory (src/shared/crud) —
 * see docs/references.md (Strapi: one generic CRUD shape reused across
 * resources) — so adding a new admin resource means adding a model +
 * validator + a few lines of wiring here, not a new controller/service.
 *
 * All routes require an authenticated internal user with the ADMIN role.
 */
const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.use('/product-categories', productCategoriesRouter);
router.use('/products', productsRouter);
router.use('/price-lists', priceListsRouter);
router.use('/customer-tiers', customerTiersRouter);
router.use('/discount-rules', discountRulesRouter);
router.use('/approval-levels', approvalLevelsRouter);
router.use('/warehouses', warehousesRouter);
router.use('/subscription-plans', subscriptionPlansRouter);
router.use('/recommendation-rules', recommendationRulesRouter);

export { router as adminRouter };
