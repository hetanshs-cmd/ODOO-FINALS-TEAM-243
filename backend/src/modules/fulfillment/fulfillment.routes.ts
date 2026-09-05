import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { fulfillmentController } from './fulfillment.controller';
import { idParamSchema, overrideSplitSchema } from './fulfillment.validator';

const OPS_ROLES = ['OPERATIONS', 'SALES_MANAGER', 'ADMIN'];

// Mounted at /api/v1/sales-orders — allocate + list fulfillments for an order.
const salesOrderFulfillmentRouter = Router();
salesOrderFulfillmentRouter.use(authenticate, requireRole(...OPS_ROLES));
salesOrderFulfillmentRouter.post(
  '/:id/suggest-fulfillment',
  validate({ params: idParamSchema }),
  fulfillmentController.allocate,
);
salesOrderFulfillmentRouter.get(
  '/:id/fulfillments',
  validate({ params: idParamSchema }),
  fulfillmentController.listBySalesOrder,
);

// Mounted at /api/v1/fulfillments — inspect + ship an individual fulfillment.
const fulfillmentsRouter = Router();
fulfillmentsRouter.use(authenticate, requireRole(...OPS_ROLES));
fulfillmentsRouter.get('/:id', validate({ params: idParamSchema }), fulfillmentController.getById);
fulfillmentsRouter.post(
  '/:id/ship',
  validate({ params: idParamSchema }),
  fulfillmentController.ship,
);
fulfillmentsRouter.post(
  '/:id/accept-split',
  validate({ params: idParamSchema }),
  fulfillmentController.acceptSplit,
);
fulfillmentsRouter.post(
  '/:id/override-split',
  validate({ params: idParamSchema, body: overrideSplitSchema }),
  fulfillmentController.overrideSplit,
);

export { salesOrderFulfillmentRouter, fulfillmentsRouter };
