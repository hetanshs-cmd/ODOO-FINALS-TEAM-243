/**
 * Customer portal auth routes — magic-link login.
 *
 * Kept in a separate route file (and, once portal resource routes exist,
 * a separate auth middleware) from internal auth, per docs/architecture.md:
 * the portal is a genuinely separate route namespace, not internal auth
 * with a different label.
 *
 * Mounted at /api/v1, so the full paths are:
 *   POST /api/v1/portal/request-link
 *   POST /api/v1/portal/verify-link
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import { portalRequestLinkSchema, portalVerifyLinkSchema, portalLoginSchema } from './auth.validator';
import * as authController from './auth.controller';

const router = Router();

router.post(
  '/portal/login',
  authLimiter,
  validate({ body: portalLoginSchema }),
  authController.portalLogin,
);
router.post(
  '/portal/request-link',
  authLimiter,
  validate({ body: portalRequestLinkSchema }),
  authController.requestLink,
);
router.post(
  '/portal/verify-link',
  authLimiter,
  validate({ body: portalVerifyLinkSchema }),
  authController.verifyLink,
);

export { router as portalRouter };
