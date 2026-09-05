import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { approvalsService } from './approvals.service';

export const approvalsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.list(req.query as { status?: string });
      sendSuccess({ res, data: result, message: 'Approval requests retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await approvalsService.getDetail(req.params['id'] as string);
      sendSuccess({ res, data: detail, message: 'Approval request retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async act(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, user_id, comment } = req.body as {
        action: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED' | 'CANCELLED';
        user_id: string;
        comment?: string | null;
      };
      const result = await approvalsService.act(req.params['id'] as string, {
        action,
        userId: user_id,
        comment,
      });
      sendSuccess({ res, data: result, message: `Approval request ${action.toLowerCase()}` });
    } catch (err) {
      next(err);
    }
  },
};
