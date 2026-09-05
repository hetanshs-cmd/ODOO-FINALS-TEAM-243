import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { backordersService } from './backorders.service';

export const backordersController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await backordersService.list(
        req.query as { status?: string; page?: unknown; limit?: unknown },
      );
      sendSuccess({ res, data: result, message: 'Backorders retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async consolidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await backordersService.consolidate(req.params['id'] as string);
      sendSuccess({ res, data: result, message: 'Backorder consolidated successfully' });
    } catch (err) {
      next(err);
    }
  },
};
