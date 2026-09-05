export type FulfillmentStatus = 'PENDING' | 'IN_PROGRESS' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type FulfillmentItemStatus = 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Fulfillment {
  id: string;
  sales_order_id: string;
  warehouse_id: string;
  status: FulfillmentStatus;
  scheduled_date: string | null;
  fulfilled_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface FulfillmentItem {
  id: string;
  fulfillment_id: string;
  sales_order_item_id: string;
  quantity: string;
  status: FulfillmentItemStatus;
  created_at: string;
  updated_at: string;
}

export interface FulfillmentWithItems extends Fulfillment {
  items: FulfillmentItem[];
}
