export type InvoiceType = 'ONE_TIME' | 'RECURRING';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  sales_order_id: string | null;
  quotation_id: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  tax: string;
  total: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'MODIFIED';

export interface Subscription {
  id: string;
  customer_id: string;
  sales_order_id: string | null;
  quotation_id: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  current_price: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  created_at: string;
  updated_at: string;
}

export interface BillingSchedule {
  id: string;
  subscription_id: string;
  billing_date: string;
  amount: string;
  status: string;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateBillingResult {
  invoice: Invoice | null;
  subscription: Subscription | null;
}
