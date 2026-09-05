import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { subscriptionsService } from './subscriptions.service';

export const subscriptionsController = {
  async modify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { plan_id, quantity } = req.body as { plan_id?: string; quantity?: number };
      const subscription = await subscriptionsService.modify(req.params['id'] as string, {
        plan_id,
        quantity,
      });
      sendSuccess({ res, data: subscription, message: 'Subscription updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscription = await subscriptionsService.cancel(req.params['id'] as string);
      sendSuccess({ res, data: subscription, message: 'Subscription cancelled successfully' });
    } catch (err) {
      next(err);
    }
  },
};
