import rateLimit from 'express-rate-limit';

/**
 * Tighter per-IP budget for credential-guessing surfaces (login, signup, the
 * portal magic-link request) than the general API limiter in app.ts. The
 * general limiter (2000/15min) exists to stop ordinary page-load fan-out
 * from 429ing — it's far too loose to stop a brute-force credential attempt,
 * which only needs a handful of requests per guess.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many attempts. Please try again later.',
  },
});
