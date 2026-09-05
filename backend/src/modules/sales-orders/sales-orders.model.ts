export type SalesOrderStatus =
  'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';

export interface SalesOrder {
  id: string;
  order_number: string;
  quotation_id: string;
  customer_id: string;
  sales_rep_id: string;
  status: SalesOrderStatus;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  order_date: string;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  total: string;
  fulfilled_quantity: string;
  backordered_quantity: string;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderWithItems extends SalesOrder {
  items: SalesOrderItem[];
}
