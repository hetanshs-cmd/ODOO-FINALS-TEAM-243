export interface PriceList {
  id: string;
  name: string;
  currency: string;
  customer_tier_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  created_at: string;
  updated_at: string;
}
