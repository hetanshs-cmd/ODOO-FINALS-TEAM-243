import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { discountEngineService } from './discount-engine.service';

export const discountEngineController = {
  async checkDiscounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await discountEngineService.checkDiscounts(req.params['id'] as string);
      sendSuccess({
        res,
        data: result,
        message:
          result.riskLevel === 'LOW'
            ? 'All discounts are within their configured ceilings; quotation approved'
            : 'Discount ceiling exceeded; quotation routed for approval',
      });
    } catch (err) {
      next(err);
    }
  },
};
