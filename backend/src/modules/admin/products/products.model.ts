export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string;
  product_type: 'ONE_TIME' | 'RECURRING';
  base_price: string;
  cost_price: string | null;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  created_at: string;
  updated_at: string;
}
