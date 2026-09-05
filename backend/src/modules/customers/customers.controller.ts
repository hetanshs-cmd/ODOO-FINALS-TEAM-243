import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { customersService } from './customers.service';

export const customersController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await customersService.list(req.query as { page?: unknown; limit?: unknown });
      sendSuccess({ res, data: result, message: 'Customers retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
