import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { approvalsService } from './approvals.service';

export const approvalsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.list(req.query as { status?: string }, req.user!);
      sendSuccess({ res, data: result, message: 'Approval requests retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await approvalsService.getDetail(req.params['id'] as string, req.user!);
      sendSuccess({ res, data: detail, message: 'Approval request retrieved successfully' });
    } catch (err) {
      next(err);
    }
  },

  async act(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, comment } = req.body as {
        action: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED' | 'CANCELLED';
        comment?: string | null;
      };
      // The acting user always comes from the authenticated session, never
      // the request body, so an approval/rejection can't be attributed to
      // someone other than whoever actually made the call.
      const result = await approvalsService.act(req.params['id'] as string, {
        action,
        userId: req.user!.id,
        comment,
      });
      sendSuccess({ res, data: result, message: `Approval request ${action.toLowerCase()}` });
    } catch (err) {
      next(err);
    }
  },
};
