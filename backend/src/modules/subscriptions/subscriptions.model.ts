import { Subscription } from '../billing/billing.model';
import { BillingFrequency } from '../billing/billingDates';

// Re-exported so callers of this module don't need to reach into billing/
// for the shape of the row they're modifying/cancelling.
export type { Subscription };

export interface SubscriptionPlanForModify {
  id: string;
  billing_frequency: BillingFrequency;
  price: string;
  status: 'ACTIVE' | 'INACTIVE';
}
