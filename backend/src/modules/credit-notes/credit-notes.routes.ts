import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { creditNotesController } from './credit-notes.controller';
import {
  idParamSchema,
  listCreditNotesQuerySchema,
  updateCreditNoteStatusSchema,
} from './credit-notes.validator';

// Same billing-adjacent role gate as subscriptions.routes.ts.
const router = Router();
router.use(authenticate, requireRole('FINANCE', 'SALES_MANAGER', 'ADMIN'));

router.get('/', validate({ query: listCreditNotesQuerySchema }), creditNotesController.list);
router.get('/:id', validate({ params: idParamSchema }), creditNotesController.getById);
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateCreditNoteStatusSchema }),
  creditNotesController.updateStatus,
);

export { router as creditNotesRouter };
