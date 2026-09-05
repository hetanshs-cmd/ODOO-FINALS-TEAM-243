export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: string;
  payment_method: string;
  transaction_reference: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
