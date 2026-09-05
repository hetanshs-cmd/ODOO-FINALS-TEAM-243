export type QuotationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT_TO_CUSTOMER'
  | 'NEGOTIATION'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'CONVERTED';

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  sales_rep_id: string;
  price_list_id: string | null;
  status: QuotationStatus;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string;
  description: string | null;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  discount_amount: string;
  tax_percent: string;
  line_total: string;
  billing_type: 'ONE_TIME' | 'RECURRING';
  created_at: string;
  updated_at: string;
}

export interface QuotationWithItems extends Quotation {
  items: QuotationItem[];
}
