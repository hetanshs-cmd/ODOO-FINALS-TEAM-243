import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { aiService } from './ai.service';

export const aiController = {
  async getInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiService.getInsight(req.body, req.user!);
      sendSuccess({ res, data: result, message: 'AI insight generated successfully' });
    } catch (err) {
      next(err);
    }
  },

  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await aiService.chat(req.body, req.user!);
      sendSuccess({ res, data: result, message: 'AI chat reply generated successfully' });
    } catch (err) {
      next(err);
    }
  },
};
