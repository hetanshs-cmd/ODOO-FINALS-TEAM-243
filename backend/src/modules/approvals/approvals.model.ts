export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
export type ApprovalAction = 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED' | 'CANCELLED';

export interface ApprovalRequest {
  id: string;
  quotation_id: string;
  requested_by: string;
  assigned_to: string | null;
  /** FK to approval_levels — renamed from approval_level in the 2026-09-05 schema refactor. */
  approval_level_id: string;
  /**
   * approval_levels.name, joined in on every read (approvals.repository.ts) —
   * NOT a real column on approval_requests. The API/frontend contract has
   * always used the field name `approval_level` for this human-readable
   * label (e.g. "Finance Review"); the FK rename above only changed the
   * internal id column, not what callers of this API see.
   */
  approval_level: string;
  status: ApprovalRequestStatus;
  reason: string | null;
  requested_at: string;
  responded_at: string | null;
  // No created_at/updated_at: the schema refactor dropped these in favor of
  // requested_at/responded_at, which already cover this row's lifecycle.
}

export interface ApprovalActionRow {
  id: string;
  approval_request_id: string;
  user_id: string;
  action: ApprovalAction;
  comment: string | null;
  created_at: string;
}
