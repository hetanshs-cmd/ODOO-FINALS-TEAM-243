export type CreditNoteStatus = 'PENDING' | 'APPLIED' | 'VOIDED';

export interface CreditNote {
  id: string;
  subscription_id: string;
  customer_id: string;
  amount: string;
  reason: string | null;
  status: CreditNoteStatus;
  created_at: string;
}
