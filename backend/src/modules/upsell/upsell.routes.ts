import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { upsellController } from './upsell.controller';
import { idParamSchema, recommendationsQuerySchema } from './upsell.validator';

// Mounted at /api/v1/products — read-only, used by the Quotation Builder's upsell panel.
const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'));
router.get(
  '/:id/recommendations',
  validate({ params: idParamSchema, query: recommendationsQuerySchema }),
  upsellController.getRecommendations
);

export { router as upsellRouter };
