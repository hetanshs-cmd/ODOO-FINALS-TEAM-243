import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { usersService } from './users.service';

export const usersController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await usersService.list();
      sendSuccess({ res, data: users, message: 'Users retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
