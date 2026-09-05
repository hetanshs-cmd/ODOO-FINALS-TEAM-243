export interface CustomerTier {
  id: string;
  name: string;
  description: string | null;
  discount_limit: string;
  priority: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}
