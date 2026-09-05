export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
export type ApprovalAction = 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED' | 'CANCELLED';

export interface ApprovalRequest {
  id: string;
  quotation_id: string;
  requested_by: string;
  assigned_to: string | null;
  approval_level: string;
  status: ApprovalRequestStatus;
  reason: string | null;
  requested_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalActionRow {
  id: string;
  approval_request_id: string;
  user_id: string;
  action: ApprovalAction;
  comment: string | null;
  created_at: string;
}
