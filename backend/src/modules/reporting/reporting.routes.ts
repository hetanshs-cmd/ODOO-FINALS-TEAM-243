import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { reportingController } from './reporting.controller';
import { discountExceptionsQuerySchema, salesSummaryQuerySchema } from './reporting.validator';

const router = Router();

router.use(authenticate, requireRole('FINANCE', 'SALES_MANAGER', 'ADMIN'));
router.get(
  '/sales-summary',
  validate({ query: salesSummaryQuerySchema }),
  reportingController.salesSummary,
);
router.get(
  '/discount-exceptions',
  validate({ query: discountExceptionsQuerySchema }),
  reportingController.discountExceptions,
);

export { router as reportingRouter };
