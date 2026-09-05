import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { quotationsController } from './quotations.controller';
import {
  createQuotationItemSchema,
  createQuotationSchema,
  idParamSchema,
} from './quotations.validator';

const router = Router();

// Quotations are created and worked by the sales org; managers and admins
// can also act on any quotation (escalation, oversight).
router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'));

router.post('/', validate({ body: createQuotationSchema }), quotationsController.create);
router.get('/:id', validate({ params: idParamSchema }), quotationsController.getById);
router.post(
  '/:id/items',
  validate({ params: idParamSchema, body: createQuotationItemSchema }),
  quotationsController.addItem
);

export { router as quotationsRouter };
