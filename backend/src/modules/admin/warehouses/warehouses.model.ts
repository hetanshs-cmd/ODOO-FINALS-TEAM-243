export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address_id: string | null;
  manager_id: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}
