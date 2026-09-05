import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { dealHealthService } from './deal-health.service';

export const dealHealthController = {
  async recalculate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dealHealthService.recalculate(req.params['id'] as string);
      sendCreated({ res, data: result, message: 'Deal health recalculated' });
    } catch (err) {
      next(err);
    }
  },

  async getLatest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dealHealthService.getLatest(req.params['id'] as string);
      sendSuccess({ res, data: result, message: 'Deal health retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dealHealthService.listOpenAlerts(
        req.query as { page?: unknown; limit?: unknown },
      );
      sendSuccess({ res, data: result, message: 'Open deal alerts retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async updateAlertStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status: 'ESCALATED' | 'NUDGED' | 'RESOLVED' };
      const alert = await dealHealthService.updateAlertStatus(
        req.params['alertId'] as string,
        status,
      );
      sendSuccess({ res, data: alert, message: `Alert marked ${status.toLowerCase()}` });
    } catch (err) {
      next(err);
    }
  },
};
