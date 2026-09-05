export interface Customer {
  id: string;
  company_name: string;
  customer_code: string;
  customer_tier_id: string;
  industry: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
}
