import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, authenticatePortal } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { negotiationsController } from './negotiations.controller';
import { addMessageSchema, idParamSchema, openNegotiationSchema } from './negotiations.validator';

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

const router = Router();

router.use(authenticateInternalOrPortal);

router.post('/', validate({ body: openNegotiationSchema }), negotiationsController.open);
router.get('/:id', validate({ params: idParamSchema }), negotiationsController.getById);
router.post(
  '/:id/messages',
  validate({ params: idParamSchema, body: addMessageSchema }),
  negotiationsController.addMessage
);

export { router as negotiationsRouter };
