export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}
