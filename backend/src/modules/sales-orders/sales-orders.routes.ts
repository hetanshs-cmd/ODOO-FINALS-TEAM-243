import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { salesOrdersController } from './sales-orders.controller';
import { idParamSchema, listSalesOrdersQuerySchema } from './sales-orders.validator';

const SALES_ORDER_ROLES = ['SALES_REP', 'SALES_MANAGER', 'OPERATIONS', 'ADMIN'];

// Mounted at /api/v1/quotations — converting a quotation is an action on it.
const quotationConversionRouter = Router();
quotationConversionRouter.use(authenticate, requireRole(...SALES_ORDER_ROLES));
quotationConversionRouter.post(
  '/:id/convert',
  validate({ params: idParamSchema }),
  salesOrdersController.convert,
);

// Mounted at /api/v1/sales-orders — list + inspect the orders themselves.
const salesOrdersRouter = Router();
salesOrdersRouter.use(authenticate, requireRole(...SALES_ORDER_ROLES));
salesOrdersRouter.get(
  '/',
  validate({ query: listSalesOrdersQuerySchema }),
  salesOrdersController.list,
);
salesOrdersRouter.get('/:id', validate({ params: idParamSchema }), salesOrdersController.getById);

export { quotationConversionRouter, salesOrdersRouter };
