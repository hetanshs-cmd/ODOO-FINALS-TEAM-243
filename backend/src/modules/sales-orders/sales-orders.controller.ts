import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { salesOrdersService } from './sales-orders.service';

export const salesOrdersController = {
  async convert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await salesOrdersService.convertFromQuotation(req.params['id'] as string);
      sendCreated({ res, data: order, message: 'Sales order created from quotation' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await salesOrdersService.getWithItems(req.params['id'] as string);
      sendSuccess({ res, data: order, message: 'Sales order retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await salesOrdersService.list(
        req.query as { status?: string; customer_id?: string },
      );
      sendSuccess({ res, data: result, message: 'Sales orders retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
