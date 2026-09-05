import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { discountEngineController } from './discount-engine.controller';

const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

const router = Router();

// Same actors as quotations — check-discounts is triggered by the sales rep
// working the quotation (or a manager/admin acting on their behalf).
router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'));

router.post(
  '/:id/check-discounts',
  validate({ params: idParamSchema }),
  discountEngineController.checkDiscounts,
);

export { router as discountEngineRouter };
