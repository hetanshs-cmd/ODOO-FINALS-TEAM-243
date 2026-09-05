import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { upsellService } from './upsell.service';

export const upsellController = {
  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, min_margin_percent } = req.query as { type?: 'UPSELL' | 'CROSS_SELL'; min_margin_percent?: number };
      const recommendations = await upsellService.getRecommendations(
        req.params['id'] as string,
        type,
        min_margin_percent
      );
      sendSuccess({ res, data: recommendations, message: 'Recommendations retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },
};
