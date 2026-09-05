import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { negotiationsService } from './negotiations.service';

export const negotiationsController = {
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await negotiationsService.listAll(
        req.query as { page?: unknown; limit?: unknown },
        req.user!,
      );
      sendSuccess({ res, data: result, message: 'Negotiations retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async open(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotationId = req.params['id'] as string;
      const initiatedBy = req.user?.id ?? (req.portalUser?.id as string);
      const negotiation = await negotiationsService.open(
        quotationId,
        initiatedBy,
        req.portalUser?.customerId,
      );
      sendCreated({ res, data: negotiation, message: 'Negotiation opened' });
    } catch (err) {
      next(err);
    }
  },

  async listForQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const negotiations = await negotiationsService.listForQuotation(
        req.params['id'] as string,
        req.portalUser?.customerId,
      );
      sendSuccess({ res, data: negotiations, message: 'Negotiations retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await negotiationsService.getDetail(
        req.params['id'] as string,
        req.portalUser?.customerId,
      );
      sendSuccess({ res, data: detail, message: 'Negotiation retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async addMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { message, message_type, changes } = req.body as {
        message: string;
        message_type: 'TEXT' | 'COUNTER_OFFER';
        changes?: { quotation_item_id: string; new_discount_percent: number }[];
      };
      const senderUserId = req.user?.id ?? (req.portalUser?.id as string);
      const result = await negotiationsService.addMessage(req.params['id'] as string, {
        senderUserId,
        message,
        messageType: message_type,
        changes,
        portalCustomerId: req.portalUser?.customerId,
      });
      sendCreated({ res, data: result, message: 'Message added to negotiation' });
    } catch (err) {
      next(err);
    }
  },
};
