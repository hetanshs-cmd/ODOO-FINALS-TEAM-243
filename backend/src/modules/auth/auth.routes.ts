/**
 * Internal auth routes — staff login.
 * Mounted at /api/v1, so the full path is POST /api/v1/auth/login.
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.validator';
import * as authController from './auth.controller';

const router = Router();

router.post('/auth/login', validate({ body: loginSchema }), authController.login);

export { router as authRouter };
