import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { quotationsController } from './quotations.controller';
import {
  createQuotationItemSchema,
  createQuotationSchema,
  idParamSchema,
  listQuotationsQuerySchema,
  updateQuotationSchema,
} from './quotations.validator';

const router = Router();

// Quotations are created and worked by the sales org; managers and admins
// can also act on any quotation (escalation, oversight).
router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'));

router.get('/', validate({ query: listQuotationsQuerySchema }), quotationsController.list);
router.post('/', validate({ body: createQuotationSchema }), quotationsController.create);
router.get('/:id', validate({ params: idParamSchema }), quotationsController.getById);
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateQuotationSchema }),
  quotationsController.update,
);
router.post(
  '/:id/items',
  validate({ params: idParamSchema, body: createQuotationItemSchema }),
  quotationsController.addItem,
);
router.post(
  '/:id/submit',
  validate({ params: idParamSchema }),
  quotationsController.submit,
);

export { router as quotationsRouter };
