import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 *
 * Logs incoming requests with method, URL, status, and response time.
 * Only logs in development and test environments.
 * Production logging should use a proper logging library (pino, winston).
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Color-code status for development readability
    const statusColor =
      statusCode >= 500
        ? '\x1b[31m' // Red
        : statusCode >= 400
        ? '\x1b[33m' // Yellow
        : statusCode >= 300
        ? '\x1b[36m' // Cyan
        : '\x1b[32m'; // Green

    console.log(
      `${statusColor}[${statusCode}]\x1b[0m ${method} ${url} — ${duration}ms`
    );
  });

  next();
}
