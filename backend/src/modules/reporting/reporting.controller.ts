import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { reportingService } from './reporting.service';

export const reportingController = {
  async salesSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await reportingService.salesSummary(
        req.query as { from?: string; to?: string },
      );
      sendSuccess({ res, data: result, message: 'Sales summary retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async discountExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await reportingService.discountExceptions(
        req.query as { page?: unknown; limit?: unknown },
      );
      sendSuccess({ res, data: result, message: 'Discount exceptions retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
