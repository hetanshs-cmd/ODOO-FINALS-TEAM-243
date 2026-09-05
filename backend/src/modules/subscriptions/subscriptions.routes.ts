import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { subscriptionsController } from './subscriptions.controller';
import { idParamSchema, modifySubscriptionSchema } from './subscriptions.validator';

// Same internal-role gate as billing (billing.routes.ts) — subscription
// modify/cancel are billing-adjacent mutations, not self-serve customer
// portal actions (no portal-scoped subscription routes exist yet).
const SUBSCRIPTION_ROLES = ['FINANCE', 'SALES_MANAGER', 'ADMIN'];

const router = Router();
router.use(authenticate, requireRole(...SUBSCRIPTION_ROLES));

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: modifySubscriptionSchema }),
  subscriptionsController.modify,
);
router.post(
  '/:id/cancel',
  validate({ params: idParamSchema }),
  subscriptionsController.cancel,
);

export { router as subscriptionsRouter };
