import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, authenticatePortal } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { negotiationsController } from './negotiations.controller';
import { addMessageSchema, idParamSchema, listNegotiationsQuerySchema } from './negotiations.validator';

/**
 * Negotiations are the one resource both internal sales reps AND portal
 * customers act on (that's the whole point of the re-approval loop in
 * docs/development-workflow.md Block 4), so this tries internal auth first
 * and falls back to portal auth rather than picking one namespace. There is
 * no single role set that fits both callers, so row-level tenant isolation
 * (checking the portal user's customerId against the quotation's) is
 * enforced in negotiations.service instead of a role-guard here.
 */
function authenticateInternalOrPortal(req: Request, res: Response, next: NextFunction): void {
  authenticate(req, res, (internalErr) => {
    if (!internalErr) {
      next();
      return;
    }
    authenticatePortal(req, res, next);
  });
}

// Mounted at /api/v1/quotations — opening a negotiation is an action on a quotation.
const quotationNegotiationsRouter = Router();
quotationNegotiationsRouter.use(authenticateInternalOrPortal);
quotationNegotiationsRouter.get(
  '/:id/negotiations',
  validate({ params: idParamSchema }),
  negotiationsController.listForQuotation,
);
quotationNegotiationsRouter.post(
  '/:id/negotiations',
  validate({ params: idParamSchema }),
  negotiationsController.open,
);

// Mounted at /api/v1/negotiations — inspect + post messages on an existing negotiation.
const negotiationsRouter = Router();
negotiationsRouter.use(authenticateInternalOrPortal);
// Sales-rep inbox — internal roles only (requireRole 401s a portal-only
// caller here since it never sets req.user), not exposed to the portal.
negotiationsRouter.get(
  '/',
  requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN'),
  validate({ query: listNegotiationsQuerySchema }),
  negotiationsController.listAll,
);
negotiationsRouter.get('/:id', validate({ params: idParamSchema }), negotiationsController.getById);
negotiationsRouter.post(
  '/:id/messages',
  validate({ params: idParamSchema, body: addMessageSchema }),
  negotiationsController.addMessage,
);

export { quotationNegotiationsRouter, negotiationsRouter };
