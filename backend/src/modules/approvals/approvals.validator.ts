import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const listApprovalsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// The acting user is taken from req.user (set by `authenticate`), never
// from the request body — the body has no user_id field so a caller can't
// forge who took the action.
export const actOnApprovalSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'ESCALATED', 'COMMENTED', 'CANCELLED']),
  comment: z.string().max(2000).optional().nullable(),
});
