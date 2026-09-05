export type NegotiationStatus = 'OPEN' | 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
export type NegotiationMessageType = 'TEXT' | 'COUNTER_OFFER' | 'SYSTEM';

export interface Negotiation {
  id: string;
  quotation_id: string;
  initiated_by: string;
  status: NegotiationStatus;
  created_at: string;
  closed_at: string | null;
}

export interface NegotiationMessage {
  id: string;
  negotiation_id: string;
  sender_user_id: string;
  message: string;
  message_type: NegotiationMessageType;
  created_at: string;
}

export interface NegotiationChange {
  id: string;
  negotiation_id: string;
  quotation_item_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  created_at: string;
}
