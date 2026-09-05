import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { creditNotesService } from './credit-notes.service';

export const creditNotesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await creditNotesService.list(
        req.query as { status?: string; customer_id?: string; subscription_id?: string },
      );
      sendSuccess({ res, data: result, message: 'Credit notes retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creditNote = await creditNotesService.getById(req.params['id'] as string);
      sendSuccess({ res, data: creditNote, message: 'Credit note retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status: 'APPLIED' | 'VOIDED' };
      const creditNote = await creditNotesService.updateStatus(req.params['id'] as string, status);
      sendSuccess({ res, data: creditNote, message: 'Credit note status updated successfully' });
    } catch (err) {
      next(err);
    }
  },
};
