import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { productsService } from './products.service';

export const productsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await productsService.list();
      sendSuccess({ res, data: result, message: 'Products retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
