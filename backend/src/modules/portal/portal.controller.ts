import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { portalService } from './portal.service';

export const portalController = {
  async listQuotations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotations = await portalService.listQuotations(req.portalUser!.customerId);
      sendSuccess({ res, data: quotations, message: 'Quotations retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await portalService.getQuotation(
        req.params['id'] as string,
        req.portalUser!.customerId,
      );
      sendSuccess({ res, data: quotation, message: 'Quotation retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await portalService.listInvoices(req.portalUser!.customerId);
      sendSuccess({ res, data: invoices, message: 'Invoices retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await portalService.getInvoice(
        req.params['id'] as string,
        req.portalUser!.customerId,
      );
      sendSuccess({ res, data: invoice, message: 'Invoice retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
