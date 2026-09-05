export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  billing_frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price: string;
  trial_days: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}
