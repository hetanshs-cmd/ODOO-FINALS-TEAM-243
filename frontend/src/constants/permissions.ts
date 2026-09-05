import { UserRole } from '../types';

export type Permission =
  | 'view_dashboard'
  | 'view_quotations'
  | 'edit_quotation'
  | 'submit_approval'
  | 'approve_quotation'
  | 'manage_fulfillment'
  | 'manage_subscriptions'
  | 'manage_invoices'
  | 'view_reports'
  | 'manage_products'
  | 'manage_discount_rules'
  | 'manage_warehouses'
  | 'manage_subscription_plans'
  | 'manage_upsell_rules'
  | 'access_customer_portal';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  sales_rep: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'view_reports',
  ],
  sales_manager: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'approve_quotation',
    'manage_fulfillment',
    'view_reports',
    'manage_discount_rules',
  ],
  finance: [
    'view_dashboard',
    'view_quotations',
    'approve_quotation',
    'manage_subscriptions',
    'manage_invoices',
    'view_reports',
    'manage_discount_rules',
  ],
  operations: [
    'view_dashboard',
    'view_quotations',
    'manage_fulfillment',
    'manage_warehouses',
    'view_reports',
  ],
  admin: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'approve_quotation',
    'manage_fulfillment',
    'manage_subscriptions',
    'manage_invoices',
    'view_reports',
    'manage_products',
    'manage_discount_rules',
    'manage_warehouses',
    'manage_subscription_plans',
    'manage_upsell_rules',
  ],
  customer: [
    'access_customer_portal',
  ],
  SalesRep: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'view_reports',
  ],
  SalesManager: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'approve_quotation',
    'manage_fulfillment',
    'view_reports',
    'manage_discount_rules',
  ],
  Finance: [
    'view_dashboard',
    'view_quotations',
    'approve_quotation',
    'manage_subscriptions',
    'manage_invoices',
    'view_reports',
    'manage_discount_rules',
  ],
  Admin: [
    'view_dashboard',
    'view_quotations',
    'edit_quotation',
    'submit_approval',
    'approve_quotation',
    'manage_fulfillment',
    'manage_subscriptions',
    'manage_invoices',
    'view_reports',
    'manage_products',
    'manage_discount_rules',
    'manage_warehouses',
    'manage_subscription_plans',
    'manage_upsell_rules',
  ],
  Customer: [
    'access_customer_portal',
  ],
};

export function hasPermission(role: UserRole | string, permission: Permission): boolean {
  const normalized = (role as string).toLowerCase().replace('_', '');
  const entry = Object.entries(ROLE_PERMISSIONS).find(
    ([k]) => k.toLowerCase().replace('_', '') === normalized
  );
  const permissions = entry ? entry[1] : ROLE_PERMISSIONS[role as string] || [];
  return permissions.includes(permission);
}
