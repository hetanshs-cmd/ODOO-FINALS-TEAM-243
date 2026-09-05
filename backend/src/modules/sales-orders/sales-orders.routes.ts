import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { salesOrdersController } from './sales-orders.controller';
import { convertQuotationSchema, idParamSchema, listSalesOrdersQuerySchema } from './sales-orders.validator';

const router = Router();

router.use(authenticate, requireRole('SALES_REP', 'SALES_MANAGER', 'OPERATIONS', 'ADMIN'));

router.get('/', validate({ query: listSalesOrdersQuerySchema }), salesOrdersController.list);
router.get('/:id', validate({ params: idParamSchema }), salesOrdersController.getById);
router.post('/', validate({ body: convertQuotationSchema }), salesOrdersController.convert);

export { router as salesOrdersRouter };
