export type BackorderStatus = 'OPEN' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';

export interface Backorder {
  id: string;
  sales_order_id: string;
  sales_order_item_id: string;
  product_id: string;
  quantity: string;
  status: BackorderStatus;
  expected_date: string | null;
  created_at: string;
  fulfilled_at: string | null;
}
