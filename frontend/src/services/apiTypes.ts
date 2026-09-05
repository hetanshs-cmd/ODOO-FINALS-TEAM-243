/**
 * Real backend entity shapes for the service layer in services/index.ts.
 *
 * Deliberately separate from ../types/index.ts: that file models the legacy
 * mock/localStorage store's richer, UI-computed shapes (still used across
 * most pages via useDealStore), which are structurally different from what
 * the real backend returns (see backend/src/modules/**\/*.model.ts, the
 * source of truth these mirror). Field names match the backend's snake_case
 * columns; monetary values are decimal strings as Postgres serializes them.
 */

// ── Quotations ──────────────────────────────────────────────────────────────
export type ApiQuotationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT_TO_CUSTOMER'
  | 'NEGOTIATION'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'CONVERTED';

export interface ApiQuotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  sales_rep_id: string;
  price_list_id: string | null;
  status: ApiQuotationStatus;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiQuotationItem {
  id: string;
  quotation_id: string;
  product_id: string;
  description: string | null;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  discount_amount: string;
  tax_percent: string;
  line_total: string;
  billing_type: 'ONE_TIME' | 'RECURRING';
  created_at: string;
  updated_at: string;
}

export interface ApiQuotationWithItems extends ApiQuotation {
  items: ApiQuotationItem[];
}

// ── Customer portal ──────────────────────────────────────────────────────────
// GET /portal/quotations/:id joins products so the customer-facing line list
// has a real label; /customers and /admin/products are gated away from portal
// tokens, so these fields have no other source.
export interface ApiPortalQuotationItem extends ApiQuotationItem {
  product_name: string;
  product_category: string;
}

export interface ApiPortalQuotation extends ApiQuotation {
  items: ApiPortalQuotationItem[];
}

export interface ApiPortalProfile {
  id: string;
  company_name: string;
  customer_code: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tier: string;
}

export interface ApiPortalNegotiation {
  id: string;
  quotation_id: string;
  quotation_number: string;
  initiated_by: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
  created_at: string;
  closed_at: string | null;
}

export interface CreateQuotationInput {
  customer_id: string;
  price_list_id?: string | null;
  currency: string;
  valid_until?: string | null;
}

export interface UpdateQuotationInput {
  price_list_id?: string | null;
  currency?: string;
  valid_until?: string | null;
}

export interface CreateQuotationItemInput {
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_percent?: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export interface ListQuery {
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined | null;
}

// ── Approvals ───────────────────────────────────────────────────────────────
export type ApiApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
export type ApiApprovalAction = 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED' | 'CANCELLED';

export interface ApiApprovalRequest {
  id: string;
  quotation_id: string;
  requested_by: string;
  assigned_to: string | null;
  approval_level: string;
  status: ApiApprovalStatus;
  reason: string | null;
  requested_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sales Orders / Fulfillment ───────────────────────────────────────────────
export type ApiFulfillmentStatus = 'PENDING' | 'IN_PROGRESS' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface ApiFulfillmentItem {
  id: string;
  fulfillment_id: string;
  sales_order_item_id: string;
  quantity: string;
  status: 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface ApiFulfillment {
  id: string;
  sales_order_id: string;
  warehouse_id: string;
  status: ApiFulfillmentStatus;
  scheduled_date: string | null;
  fulfilled_date: string | null;
  created_at: string;
  updated_at: string;
  items?: ApiFulfillmentItem[];
}

// ── Billing / Invoices / Payments ───────────────────────────────────────────
export type ApiInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export interface ApiInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  tax: string;
  total: string;
  created_at: string;
  updated_at: string;
}

export interface ApiInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  sales_order_id: string | null;
  quotation_id: string | null;
  invoice_type: 'ONE_TIME' | 'RECURRING';
  status: ApiInvoiceStatus;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  items?: ApiInvoiceItem[];
}

export type ApiPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface ApiPayment {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: string;
  payment_method: string;
  transaction_reference: string | null;
  status: ApiPaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordPaymentInput {
  amount: number;
  payment_method: string;
  transaction_reference?: string;
}

export type ApiSubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'MODIFIED';

export interface ApiSubscription {
  id: string;
  customer_id: string;
  sales_order_id: string | null;
  quotation_id: string | null;
  plan_id: string;
  status: ApiSubscriptionStatus;
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  current_price: string;
  created_at: string;
  updated_at: string;
}

// ── Negotiations ─────────────────────────────────────────────────────────────
export type ApiNegotiationStatus = 'OPEN' | 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';

export interface ApiNegotiation {
  id: string;
  quotation_id: string;
  initiated_by: string;
  status: ApiNegotiationStatus;
  created_at: string;
  closed_at: string | null;
}

export interface ApiNegotiationMessage {
  id: string;
  negotiation_id: string;
  sender_user_id: string;
  message: string;
  message_type: 'TEXT' | 'COUNTER_OFFER' | 'SYSTEM';
  created_at: string;
}

export interface AddNegotiationMessageInput {
  message: string;
  message_type?: 'TEXT' | 'COUNTER_OFFER';
  changes?: { quotation_item_id: string; new_discount_percent: number }[];
}

// ── Deal Health ──────────────────────────────────────────────────────────────
export interface ApiDealHealthScore {
  id: string;
  quotation_id: string;
  score: string;
  risk_level: string;
  discount_risk: string;
  negotiation_risk: string;
  delay_risk: string;
  fulfillment_risk: string;
  calculated_at: string;
  created_at: string;
}

export type ApiDealAlertType = 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
export type ApiDealAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ApiDealAlert {
  id: string;
  quotation_id: string;
  /** Joined in by the list endpoint so callers don't need a second lookup. */
  quotation_number: string;
  alert_type: ApiDealAlertType;
  severity: ApiDealAlertSeverity;
  message: string;
  status: 'OPEN' | 'ESCALATED' | 'NUDGED' | 'RESOLVED';
  created_at: string;
  resolved_at: string | null;
}

// ── Notifications ────────────────────────────────────────────────────────────
export interface ApiNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

// ── Upsell ───────────────────────────────────────────────────────────────────
export interface ApiRecommendation {
  id: string;
  product_id: string;
  recommended_product_id: string;
  reason: string | null;
  [key: string]: unknown;
}

// ── Reporting ────────────────────────────────────────────────────────────────
export interface ApiSalesSummary {
  [key: string]: unknown;
}
export interface ApiDiscountExceptions {
  [key: string]: unknown;
}

// ── Customers (read-only directory) ─────────────────────────────────────────
// GET /api/v1/customers — separate from the ADMIN-only /admin/customers CRUD
// (adminService.customers). Available to SALES_REP/SALES_MANAGER/ADMIN for
// display/lookup purposes (name, tier) rather than full record management.
export interface ApiCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  customer_tier_id?: string | null;
  tier?: string | null;
  assigned_rep_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Users (id/name/role directory) ──────────────────────────────────────────
// GET /api/v1/users — used for approver/assignee/sales-rep display names.
export interface ApiUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  active?: boolean;
  [key: string]: unknown;
}

// ── Quotation timeline (audit-log-backed activity feed) ─────────────────────
export interface ApiTimelineEvent {
  id: string;
  quotation_id: string;
  actor_user_id?: string | null;
  event_type: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  [key: string]: unknown;
}

// ── Admin: Warehouses ────────────────────────────────────────────────────────
// Exact backend column set unverified from this branch (backend/admin
// warehouses model lives on the `backend` branch) — kept loose via the index
// signature so unexpected/extra fields don't break the CRUD wiring.
export interface ApiWarehouse {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  shipping_cost_weight?: number | string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ── Admin: Products (minimal, for lookups in upsell/warehouse admin pages) ──
export interface ApiProduct {
  id: string;
  name: string;
  sku?: string | null;
  category_id?: string | null;
  base_price?: string | number;
  price?: string | number;
  status?: string;
  [key: string]: unknown;
}

export interface ApiProductCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
}

// ── Admin: Recommendation Rules (= "Upsell rules" in the mock UI) ───────────
export interface ApiRecommendationRule {
  id: string;
  source_product_id: string;
  recommended_product_id: string;
  recommendation_type: string;
  priority: number;
  reason: string | null;
  status: string;
  [key: string]: unknown;
}

// ── Admin: Discount Rules (= "Discount tiers" + "Category ceilings") ────────
// Field names are a best-effort guess pending confirmation against the
// `backend` branch model — kept loose via the index signature. Scope is
// expressed via nullable product/category/customer_tier columns per
// docs/references.md's Medusa pricing note (strictest-wins precedence).
export interface ApiDiscountRule {
  id: string;
  product_id?: string | null;
  category?: string | null;
  customer_tier?: string | null;
  max_discount_percent: number | string;
  active?: boolean;
  status?: string;
  priority?: number;
  [key: string]: unknown;
}

// ── Admin: Approval Levels (= "Approval rule config") ────────────────────────
export interface ApiApprovalLevel {
  id: string;
  name?: string;
  min_discount_percent?: number | string;
  max_discount_percent?: number | string;
  required_role?: string;
  required_roles?: string[];
  risk_level?: string;
  priority?: number;
  active?: boolean;
  status?: string;
  [key: string]: unknown;
}

// ── Backorders ───────────────────────────────────────────────────────────────
export type ApiBackorderStatus = 'OPEN' | 'CONSOLIDATED' | 'FULFILLED' | 'CANCELLED';

export interface ApiBackorder {
  id: string;
  sales_order_id: string;
  fulfillment_id?: string | null;
  warehouse_id?: string | null;
  status: ApiBackorderStatus;
  quantity: string;
  expected_date?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ── Credit Notes ─────────────────────────────────────────────────────────────
export type ApiCreditNoteStatus = 'PENDING' | 'ISSUED' | 'APPLIED' | 'VOID';

export interface ApiCreditNote {
  id: string;
  customer_id: string;
  subscription_id?: string | null;
  invoice_id?: string | null;
  amount: string;
  reason?: string | null;
  status: ApiCreditNoteStatus;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}
