import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { quotationsService } from './quotations.service';

export const quotationsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.create(req.body, req.user!.id);
      sendCreated({ res, data: quotation, message: 'Quotation created successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.getWithItems(req.params['id'] as string, req.user!);
      sendSuccess({ res, data: quotation, message: 'Quotation retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await quotationsService.list(
        req.query as { status?: string; customer_id?: string },
        req.user!,
      );
      sendSuccess({ res, data: result, message: 'Quotations retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.update(
        req.params['id'] as string,
        req.body,
        req.user!,
      );
      sendSuccess({ res, data: quotation, message: 'Quotation updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await quotationsService.addItem(req.params['id'] as string, req.body, req.user!);
      sendCreated({ res, data: item, message: 'Quotation item added successfully' });
    } catch (err) {
      next(err);
    }
  },

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await quotationsService.updateItem(
        req.params['id'] as string,
        req.params['itemId'] as string,
        req.body,
        req.user!,
      );
      sendSuccess({ res, data: item, message: 'Quotation item updated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await quotationsService.removeItem(req.params['id'] as string, req.params['itemId'] as string, req.user!);
      sendSuccess({ res, data: null, message: 'Quotation item removed successfully' });
    } catch (err) {
      next(err);
    }
  },

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await quotationsService.submit(req.params['id'] as string, req.user!);
      sendSuccess({ res, data: quotation, message: 'Quotation submitted successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeline = await quotationsService.getTimeline(req.params['id'] as string, req.user!);
      sendSuccess({ res, data: timeline, message: 'Quotation timeline retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
