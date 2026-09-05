import { Router } from 'express';
import { authenticatePortal } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { portalController } from './portal.controller';
import { idParamSchema } from './portal.validator';

/**
 * Read-only customer-portal access to a customer's own quotations/invoices.
 * Mounted at /api/v1/portal, so the full paths are:
 *   GET /api/v1/portal/quotations
 *   GET /api/v1/portal/quotations/:id
 *   GET /api/v1/portal/invoices
 *   GET /api/v1/portal/invoices/:id
 *   GET /api/v1/portal/profile
 *   GET /api/v1/portal/negotiations
 *
 * Every query is filtered by req.portalUser.customerId in portal.repository —
 * the same row-level tenant-isolation pattern as negotiations.service.ts —
 * so a customer can never see another customer's records, even by guessing
 * an id.
 */
const router = Router();
router.use(authenticatePortal);

router.get('/quotations', portalController.listQuotations);
router.get('/quotations/:id', validate({ params: idParamSchema }), portalController.getQuotation);
router.get('/invoices', portalController.listInvoices);
router.get('/invoices/:id', validate({ params: idParamSchema }), portalController.getInvoice);
router.get('/profile', portalController.getProfile);
router.get('/negotiations', portalController.listNegotiations);

// FR9 — customer confirmation. Re-runs the discount engine before accepting,
// so confirming a negotiated quotation can silently re-enter approval rather
// than bypassing the ceiling. Produces the ACCEPTED status that
// POST /quotations/:id/convert requires.
router.post(
  '/quotations/:id/confirm',
  validate({ params: idParamSchema }),
  portalController.confirmQuotation,
);

export { router as portalResourcesRouter };
