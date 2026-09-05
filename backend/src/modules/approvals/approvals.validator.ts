import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid('id must be a valid UUID') });

export const listApprovalsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// user_id is accepted in the body as a temporary stand-in for req.user.id
// until the `auth` module lands (see docs/references.md TODO markers in the
// admin module for the same gap). The FK to users(id) is still enforced by
// the database either way.
export const actOnApprovalSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'ESCALATED', 'COMMENTED', 'CANCELLED']),
  user_id: z.string().uuid(),
  comment: z.string().max(2000).optional().nullable(),
});
