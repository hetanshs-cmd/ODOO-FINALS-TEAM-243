/**
 * Rate limiting — one place for every limiter in the app.
 *
 * `RATE_LIMIT_ENABLED` (env) decides whether any of this is enforced; when
 * unset it defaults to "production only". When disabled, every export below
 * is a transparent pass-through, so call sites never need their own guard.
 *
 * Three budgets, tightest last:
 *   apiLimiter   — every request, catches broad abuse without touching normal
 *                  SPA page-load fan-out
 *   loginLimiter — POST /auth/login only; ignores successful logins so a busy
 *                  legit user is never locked out, only repeated failures count
 *   authLimiter  — signup + portal magic-link request; credential-guessing
 *                  surfaces that need far fewer requests per attempt
 */
import rateLimit, { Options } from 'express-rate-limit';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config/env';

export const rateLimitingEnabled: boolean =
  config.RATE_LIMIT_ENABLED ?? config.NODE_ENV === 'production';

const passthrough: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => next();

function makeLimiter(max: number, message: string, extra?: Partial<Options>): RequestHandler {
  if (!rateLimitingEnabled) return passthrough;
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'RATE_LIMIT_EXCEEDED', message },
    ...extra,
  });
}

/** App-wide, mounted first in app.ts. */
export const apiLimiter = makeLimiter(
  config.RATE_LIMIT_MAX,
  'Too many requests. Please try again later.',
);

/** POST /api/v1/auth/login — only failed attempts count toward the budget. */
export const loginLimiter = makeLimiter(
  config.RATE_LIMIT_LOGIN_MAX,
  'Too many login attempts. Please wait a few minutes and try again.',
  { skipSuccessfulRequests: true },
);

/** Signup + portal magic-link request. */
export const authLimiter = makeLimiter(
  config.RATE_LIMIT_AUTH_MAX,
  'Too many attempts. Please try again later.',
);
