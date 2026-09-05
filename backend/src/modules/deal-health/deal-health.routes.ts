import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { dealHealthController } from './deal-health.controller';
import {
  alertIdParamSchema,
  idParamSchema,
  listAlertsQuerySchema,
  updateAlertStatusSchema,
} from './deal-health.validator';

const DEAL_HEALTH_ROLES = ['SALES_REP', 'SALES_MANAGER', 'ADMIN'];

// Mounted at /api/v1/quotations — per-quotation health score and alerts.
const quotationDealHealthRouter = Router();
quotationDealHealthRouter.use(authenticate, requireRole(...DEAL_HEALTH_ROLES));
quotationDealHealthRouter.get(
  '/:id/deal-health',
  validate({ params: idParamSchema }),
  dealHealthController.getLatest,
);
quotationDealHealthRouter.post(
  '/:id/deal-health/recalculate',
  validate({ params: idParamSchema }),
  dealHealthController.recalculate,
);

// Mounted at /api/v1/deal-health — the dashboard-wide open-alerts feed.
const dealHealthAlertsRouter = Router();
dealHealthAlertsRouter.use(authenticate, requireRole(...DEAL_HEALTH_ROLES));
dealHealthAlertsRouter.get(
  '/',
  validate({ query: listAlertsQuerySchema }),
  dealHealthController.listAlerts,
);
dealHealthAlertsRouter.post(
  '/:alertId',
  validate({ params: alertIdParamSchema, body: updateAlertStatusSchema }),
  dealHealthController.updateAlertStatus,
);

export { quotationDealHealthRouter, dealHealthAlertsRouter };
