import { Router, Request, Response } from 'express';
import { db } from '../config/database';

const router = Router();

/**
 * GET /api/v1/health
 *
 * Health check endpoint — no authentication required.
 * Used by Docker health checks, CI, and monitoring.
 *
 * Returns:
 *   200 OK — service and database are healthy
 *   503 Service Unavailable — database is unreachable
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  let dbHealthy = false;
  let dbLatencyMs: number | null = null;

  try {
    const start = Date.now();
    await db.query('SELECT 1');
    dbLatencyMs = Date.now() - start;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const status = dbHealthy ? 'ok' : 'degraded';
  const httpStatus = dbHealthy ? 200 : 503;

  res.status(httpStatus).json({
    success: dbHealthy,
    data: {
      status,
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '1.0.0',
      database: {
        healthy: dbHealthy,
        latencyMs: dbLatencyMs,
      },
    },
    message: dbHealthy ? 'Service is healthy' : 'Service is degraded',
  });
});

export { router as healthRouter };
