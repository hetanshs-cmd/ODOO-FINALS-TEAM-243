import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { fulfillmentService } from './fulfillment.service';

export const fulfillmentController = {
  async allocate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await fulfillmentService.allocate(
        req.params['id'] as string,
        req.user?.id ?? null,
      );
      sendCreated({ res, data: result, message: 'Sales order allocated across warehouses' });
    } catch (err) {
      next(err);
    }
  },

  async listBySalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fulfillments = await fulfillmentService.listBySalesOrder(req.params['id'] as string);
      sendSuccess({ res, data: fulfillments, message: 'Fulfillments retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fulfillment = await fulfillmentService.getWithItems(req.params['id'] as string);
      sendSuccess({ res, data: fulfillment, message: 'Fulfillment retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async ship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fulfillment = await fulfillmentService.ship(
        req.params['id'] as string,
        req.user?.id ?? null,
      );
      sendSuccess({ res, data: fulfillment, message: 'Fulfillment marked as shipped' });
    } catch (err) {
      next(err);
    }
  },

  async acceptSplit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fulfillment = await fulfillmentService.acceptSplit(
        req.params['id'] as string,
        req.user?.id ?? null,
      );
      sendSuccess({ res, data: fulfillment, message: 'Fulfillment split accepted' });
    } catch (err) {
      next(err);
    }
  },

  async overrideSplit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items } = req.body as { items: { sales_order_item_id: string; quantity: number }[] };
      const fulfillment = await fulfillmentService.overrideSplit(
        req.params['id'] as string,
        items,
        req.user?.id ?? null,
      );
      sendSuccess({ res, data: fulfillment, message: 'Fulfillment split overridden' });
    } catch (err) {
      next(err);
    }
  },
};
