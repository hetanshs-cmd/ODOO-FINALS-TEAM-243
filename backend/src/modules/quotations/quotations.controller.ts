import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { quotationsService } from './quotations.service';

export const quotationsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.create(req.body);
      sendCreated({ res, data: quotation, message: 'Quotation created successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.getWithItems(req.params['id'] as string);
      sendSuccess({ res, data: quotation, message: 'Quotation retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await quotationsService.addItem(req.params['id'] as string, req.body);
      sendCreated({ res, data: item, message: 'Quotation item added successfully' });
    } catch (err) {
      next(err);
    }
  },
};
