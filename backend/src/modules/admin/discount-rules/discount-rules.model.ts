export interface DiscountRule {
  id: string;
  name: string;
  priority: number;
  product_id: string | null;
  category_id: string | null;
  customer_tier_id: string | null;
  sales_role: string | null;
  min_discount: string;
  max_discount: string;
  approval_required: boolean;
  approval_level: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}
