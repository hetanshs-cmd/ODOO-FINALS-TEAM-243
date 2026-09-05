/**
 * Internal auth routes — staff login.
 * Mounted at /api/v1, so the full path is POST /api/v1/auth/login.
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/authRateLimit';
import { loginSchema, signupSchema } from './auth.validator';
import * as authController from './auth.controller';

const router = Router();

router.post('/auth/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/auth/signup', authLimiter, validate({ body: signupSchema }), authController.signup);

export { router as authRouter };
