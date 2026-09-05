import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { approvalsController } from './approvals.controller';
import {
  actOnApprovalSchema,
  idParamSchema,
  listApprovalsQuerySchema,
} from './approvals.validator';

const router = Router();

router.use(authenticate);

// Reps can view the status of requests raised on their own quotations;
// managers, finance and admins can act on them (approve, reject, escalate,
// cancel) — the per-request role gate in approvals.service.act then narrows
// each step to the role bound to its approval level.
router.get(
  '/',
  requireRole('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
  validate({ query: listApprovalsQuerySchema }),
  approvalsController.list,
);
router.get(
  '/:id',
  requireRole('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
  validate({ params: idParamSchema }),
  approvalsController.getById,
);
router.post(
  '/:id/act',
  requireRole('SALES_MANAGER', 'FINANCE', 'ADMIN'),
  validate({ params: idParamSchema, body: actOnApprovalSchema }),
  approvalsController.act,
);

export { router as approvalsRouter };
