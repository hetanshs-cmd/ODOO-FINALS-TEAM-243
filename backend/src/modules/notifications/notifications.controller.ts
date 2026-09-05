import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationsService.list(
        req.user!.id,
        req.query as { page?: unknown; limit?: unknown },
      );
      sendSuccess({ res, data: result, message: 'Notifications retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationsService.markRead(
        req.params['id'] as string,
        req.user!.id,
      );
      sendSuccess({ res, data: notification, message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  },
};
