import { Request, Response, NextFunction } from 'express';

/**
 * 404 Not Found Handler
 *
 * Catches any request that did not match a registered route.
 * Must be registered AFTER all routes, BEFORE the error handler.
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
