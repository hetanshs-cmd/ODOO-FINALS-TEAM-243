import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { config } from '../config/env';

/**
 * Global Error Handler Middleware
 *
 * Must be registered LAST in Express middleware chain.
 * Catches all errors thrown by route handlers and formats
 * them as safe, structured JSON responses.
 *
 * Security principle: Never expose stack traces, database
 * internals, or secrets in API responses.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod Validation Errors ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    });
    return;
  }

  // ── Operational AppErrors ──────────────────────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // ── Unexpected / Programming Errors ───────────────────────────────────────
  // Log full details on the server, but NEVER send internals to client
  console.error('[ERROR] Unhandled error:', {
    error: err,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // In development, include stack trace in server log only
  if (config.NODE_ENV === 'development' && err instanceof Error) {
    console.error(err.stack);
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
