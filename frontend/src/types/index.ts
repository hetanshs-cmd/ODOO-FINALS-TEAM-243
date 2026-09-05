/**
 * DealFlow360 — Master Shared Type Definitions
 * Enterprise-grade TypeScript definitions matching all Prompt 0, 1 & 2 requirements.
 */

export type UserRole =
  | 'sales_rep'
  | 'sales_manager'
  | 'finance'
  | 'operations'
  | 'admin'
  | 'customer'
  // Legacy aliases for backward compatibility with earlier UI
  | 'SalesRep'
  | 'SalesManager'
  | 'Finance'
  | 'Admin'
  | 'Customer'
  // Real backend role names (roles.name), as returned by POST /auth/login
  // and encoded in the internal JWT's `role` claim.
  | 'SALES_REP'
  | 'SALES_MANAGER'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'ADMIN'
  | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  companyId?: string;
  active: boolean;
  title?: string;
  department?: string;
  customerId?: string; // If customer role, linked to Customer entity
}

export interface CustomerPortalUser {
  id: string;
  customerId: string;
  email: string;
  name: string;
}

export type CustomerTier = 'Bronze' | 'Silver' | 'Gold';

export interface Customer {
  id: string;
  name: string;
  company: string;
  tier: CustomerTier;
  priceListId?: string;
  email: string;
  phone?: string;
  assignedRepId?: string;
  industry?: string;
  historicalAverageDiscount: number;
  createdAt: string;
  contactPerson?: string;
  billingAddress?: string;
  shippingAddress?: string;
}

export interface ProductVariant {
  attribute: string;
  values: string[];
  extraPriceByValue: Record<string, number>;
}

export interface PriceListEntry {
  tier: CustomerTier;
  currency: string;
  rule: string;
}

export type ProductCategory = 'Hardware' | 'Services' | 'Subscription';

export interface Product {
  id: string;
  sku?: string;
  name: string;
  category: ProductCategory;
  description: string;
  price: number;
  basePrice: number; // alias for price for backwards compatibility
  unit: string;
  taxPercent: number;
  isSubscription: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly';
  quantityOnHand?: number;
  status: 'Active' | 'Archived';
  variants: ProductVariant[];
  priceListEntries: PriceListEntry[];
  costBasisPercent: number; // default 60%
  discountCeilingPercent: number; // Category or product-level discount ceiling
}

export interface DiscountTierRule {
  tier: CustomerTier;
  maxDiscountPercent: number;
}

// Alias for backwards compatibility
export type DiscountTier = DiscountTierRule;

export interface CategoryDiscountRule {
  category: ProductCategory;
  maxDiscountPercent: number;
}

// Alias for backwards compatibility
export type CategoryCeiling = CategoryDiscountRule;

export type ApprovalRole = 'sales_manager' | 'finance' | 'SalesManager' | 'Finance';

export interface ApprovalChainRule {
  id?: string;
  name?: string;
  discountRange: 'within_limit' | 'over_limit_medium' | 'over_limit_high';
  riskLevel?: RiskLevel;
  requiredApprovers: ('sales_manager' | 'finance')[];
  minDiscountPercent?: number;
  maxDiscountPercent?: number;
  active?: boolean;
  priority?: number;
}

export type QuotationStage =
  | 'Draft'
  | 'Pending Approval'
  | 'PendingApproval' // legacy alias
  | 'Approved'
  | 'Sent'
  | 'Negotiation'
  | 'Confirmed'
  | 'Fulfillment'
  | 'Completed'
  | 'Rejected'
  | 'Returned for Revision'
  | 'ReturnedForRevision';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface QuotationLine {
  id: string;
  productId: string;
  productName?: string;
  category?: ProductCategory;
  quantity: number;

  baseUnitPrice: number;
  unitPrice: number;

  discountPercent: number;
  categoryLimitPercent: number;

  subtotal: number;
  discountAmount: number;
  lineTotal: number;

  overBy: number;
  overByPoints?: number; // legacy alias
  lineStatus: 'OK' | 'OVER';

  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  marginImpact?: number; // legacy alias

  isSubscription: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly';
}

export interface Quotation {
  id: string;
  code: string; // e.g. Q-1042
  customerId: string;
  customerName?: string;
  customerTier?: CustomerTier;
  priceListTier: CustomerTier;

  stage: QuotationStage;
  lines: QuotationLine[];

  subtotal: number;
  totalDiscount: number;
  totalDiscountAmount?: number; // legacy alias
  taxableAmount?: number;
  tax: number;
  grandTotal: number;
  totalAmount?: number; // legacy alias
  netAmount?: number; // legacy alias

  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  blendedMarginPercent?: number; // legacy alias

  blendedRiskScore: number;
  blendedRiskValue: RiskLevel;
  blendedRiskLevel?: RiskLevel; // legacy alias

  requiredApprovers: ('sales_manager' | 'finance')[];
  currentApprovalStep: number;
  approvalRequired?: boolean; // legacy alias
  currentApprovalRole?: ApprovalRole;

  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;

  assignedRepId: string;
  repId?: string; // legacy alias
  repName?: string;
  assignedApproverRole?: ApprovalRole;

  viewCount: number;
  negotiationStatus?: 'None' | 'Pending' | 'Accepted' | 'Rejected' | 'UnderReview';

  fulfillmentOrderId?: string;
  invoiceIds?: string[];
  subscriptionIds?: string[];
  notes?: string;
  orderDiscountPercent?: number;
  orderDiscountAmount?: number;
  expirationDate?: string;
  requestedDeliveryDate?: string;
  deliveryDate?: string;
  shippedUnits?: number;
  backorderedUnits?: number;
  revisionNote?: string;
}

export type ApprovalAction =
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'ReturnedForRevision'
  | 'Returned';

export interface ApprovalStep {
  id: string;
  quotationId: string;
  stepOrder: number;
  approverRole: 'sales_manager' | 'finance' | 'SalesManager' | 'Finance';
  status: 'Pending' | 'Approved' | 'Returned' | 'Rejected' | 'Skipped' | 'Waiting';
  actorId?: string;
  actorName?: string;
  action?: ApprovalAction;
  date?: string;
  timestamp?: string; // legacy alias
  note?: string;
  user?: string; // legacy alias
  pass?: number;
}

export interface WarehouseStock {
  productId: string;
  inStock: number;
  reserved: number;
}

export interface Warehouse {
  id: string;
  code?: string;
  name: string;
  location?: string;
  city?: string;
  stock: WarehouseStock[];
  shippingCostWeight: number;
  active: boolean;
  isPrimary?: boolean;
}

// Legacy StockLevel interface for backward compatibility
export interface StockLevel {
  warehouseId: string;
  productId: string;
  inStock: number;
  reserved: number;
  available: number;
}

export interface WarehouseSplitAllocation {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  quantityFulfilled: number;
  quantity?: number; // legacy alias for quantityFulfilled
  estimatedShipments: number;
  shippingCost: number;
  handlingCost?: number;
  totalCost?: number;
}

export interface WarehouseSplitResult {
  strategy: string;
  allocations: WarehouseSplitAllocation[];
  totalShipments: number;
  estimatedCost: number;
  explanation?: string;
  costBreakdown?: {
    shippingCost: number;
    handlingCost: number;
    totalFulfillmentCost: number;
  };
  backorderedLines: {
    productId: string;
    productName: string;
    requested: number;
    fulfilled: number;
    backordered: number;
    quantity?: number; // legacy alias
  }[];
  quotationId?: string;
  requiresSplit?: boolean;
  isSplit?: boolean;
  totalCost?: number;
  leadTimeDays?: number;
  fulfillmentStatus?: string;
  notes?: string;
}

// Legacy FulfillmentSplit interface for backward compatibility
export interface FulfillmentSplit {
  id?: string;
  quotationId: string;
  warehouseId: string;
  warehouseName?: string;
  productId?: string;
  quantity: number;
  estimatedShipments: number;
  cost: number;
  isManualOverride: boolean;
  status?: 'Allocated' | 'Shipped' | 'Backordered';
}

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'Monthly' | 'Quarterly' | 'Yearly';

export interface SubscriptionPlan {
  id: string;
  productId?: string;
  name: string;
  cycle: 'monthly' | 'quarterly' | 'yearly';
  price: number;
  baseAmount?: number; // legacy alias
  active: boolean;
  prorationRule?: string;
}

export type SubscriptionStatus = 'Active' | 'Paused' | 'Cancelled';

export interface Subscription {
  id: string;
  code?: string;
  customerId: string;
  customerName?: string;
  customerTier?: 'Bronze' | 'Silver' | 'Gold' | 'Custom';
  quotationId: string;
  quotationCode?: string;
  planId: string;
  planName?: string;
  cycle: 'monthly' | 'quarterly' | 'yearly';
  status: SubscriptionStatus;
  quantity: number;
  startDate: string;
  nextBillDate: string;
  unitRecurringPrice: number;
  amount?: number;
  currency?: string;
  notes?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  lastProratedAt?: string;
}

export type BillingScheduleType =
  | 'initial'
  | 'recurring'
  | 'proration'
  | 'credit'
  | 'refund';

export type BillingScheduleStatus = 'Upcoming' | 'Due' | 'Paid' | 'Cancelled';

export interface BillingScheduleEntry {
  id: string;
  subscriptionId?: string;
  quotationId?: string;
  billingDate: string;
  amount: number;
  status: BillingScheduleStatus;
  type: BillingScheduleType;
  description?: string;
  cycleNumber?: number;
  periodStartDate?: string;
  periodEndDate?: string;
  invoiceDate?: string;
  dueDate?: string;
}

export interface BillingRecord {
  quotationId: string;
  oneTimeLines: QuotationLine[];
  recurringLines: QuotationLine[];
  billingSchedule: BillingScheduleEntry[];
}

export interface ProrationResult {
  previousAmount: number;
  newAmount: number;
  remainingDays: number;
  totalDays: number;
  totalDaysInPeriod?: number;
  proratedCharge: number;
  creditAmount: number;
  netAdjustment: number;
  effectiveDate?: string;
  periodStart?: string;
  periodEnd?: string;
  ruleApplied?: string;
  description?: string;
  explanation?: string;
}

export interface ProrationEvent {
  id: string;
  subscriptionId: string;
  quotationId?: string;
  effectiveDate: string;
  periodStart: string;
  periodEnd: string;
  previousPlanName: string;
  previousQuantity: number;
  previousAmount: number;
  newPlanName: string;
  newQuantity: number;
  newAmount: number;
  totalDaysInPeriod: number;
  remainingDays: number;
  creditAmount: number;
  proratedCharge: number;
  netAdjustment: number;
  createdAt: string;
  ruleApplied?: string;
  appliedCreditNoteId?: string;
  appliedInvoiceId?: string;
  description?: string;
}

export interface CreditNote {
  id: string;
  code: string; // e.g. CN-2026-0104
  subscriptionId?: string;
  subscriptionCode?: string;
  quotationId?: string;
  quotationCode?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  status: 'Draft' | 'Applied' | 'Refunded';
  reason: string;
  createdAt: string;
  effectiveDate: string;
  periodStart?: string;
  periodEnd?: string;
}

export type ProrationRule = 'daily_linear' | 'full_month' | 'none';
export type CancellationRefundPolicy = 'prorated_credit' | 'full_credit' | 'no_refund';

export interface SubscriptionBillingConfig {
  prorationRule: ProrationRule;
  cancellationRefundRule: CancellationRefundPolicy;
  allowMidCycleUpgrade: boolean;
  creditNotePrefix: string;
}

export interface HybridOrderLine {
  id: string;
  productId: string;
  productName: string;
  category: 'Hardware' | 'Software' | 'Services' | 'Subscription';
  quantityOrdered: number;
  quantityFulfilled: number;
  quantityPending: number;
  unitPrice: number;
  lineTotal: number;
  invoiceEligibleAmount: number;
  isSubscription: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly';
  fulfillmentStatus: 'Fulfilled' | 'Partially Shipped' | 'Awaiting Shipment' | 'Not Applicable';
  quantity: number;
  backorderQuantity: number;
  invoicableAmount: number;
  deferredAmount: number;
  isFullyFulfilled: boolean;
  isPartiallyFulfilled: boolean;
}

export interface FirstInvoiceSummary {
  quotationId: string;
  eligibleOneTimeSubtotal: number;
  pendingOneTimeSubtotal: number;
  recurringInitialCharge: number;
  prorationAdjustment: number;
  firstInvoiceEligibleTotal: number;
  lines: HybridOrderLine[];
  hasPendingPhysicalItems: boolean;
  physicalTotal: number;
  physicalLines: HybridOrderLine[];
  servicesTotal: number;
  serviceLines: HybridOrderLine[];
  immediatelyInvoicableTotal: number;
  recurringMRR: number;
  recurringLines: HybridOrderLine[];
}

export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Overdue' | 'Partially Paid' | 'Draft' | 'Applied' | 'Cancelled';
export type DeliveryStage = 'Order Confirmed' | 'Partially Shipped' | 'Shipped' | 'Invoiced' | 'Paid' | 'Not Applicable';
export type InvoiceType = 'OneTime' | 'Recurring' | 'Proration' | 'Credit Note' | 'One-Time';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Bank Transfer' | 'Card' | 'Cheque' | 'Other' | string;
  reference: string;
  note?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface InvoiceAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  role?: string;
  note?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productId?: string;
  productName?: string;
  category?: 'Hardware' | 'Software' | 'Services' | 'Subscription' | 'Adjustment' | 'Credit';
  discountPercent?: number;
  discountAmount?: number;
  orderedQty?: number;
  shippedQty?: number;
  eligibleQty?: number;
  billedQty?: number;
  remainingToShipQty?: number;
  remainingToInvoiceQty?: number;
  tax?: number;
  periodStart?: string;
  periodEnd?: string;
  cycle?: 'monthly' | 'quarterly' | 'yearly';
  fulfillmentStatus?: 'Fulfilled' | 'Partially Shipped' | 'Awaiting Shipment' | 'Not Applicable';
  isSubscription?: boolean;
}

export interface Invoice {
  id: string;
  code: string;
  quotationId: string;
  quotationCode?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  subtotal?: number;
  discountAmount?: number;
  tax?: number;
  prorationAdjustment?: number;
  creditAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  status: InvoiceStatus;
  dueDate: string;
  deliveryStage: DeliveryStage;
  isRecurring: boolean;
  type?: InvoiceType;
  issueDate: string;
  paidAt?: string;
  subscriptionId?: string;
  subscriptionCode?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  lines?: InvoiceLine[];
  payments?: PaymentRecord[];
  auditTrail?: InvoiceAuditEntry[];
  notes?: string;
  isCreditNote?: boolean;
}

export interface DeliveryReconciliationItem {
  productId: string;
  productName: string;
  category: 'Hardware' | 'Software' | 'Services' | 'Subscription';
  orderedQty: number;
  shippedQty: number;
  invoicedQty: number;
  remainingToShipQty: number;
  remainingToInvoiceQty: number;
  unitPrice: number;
  invoicableAmount: number;
  deferredAmount: number;
  fulfillmentStatus: 'Fulfilled' | 'Partially Shipped' | 'Awaiting Shipment' | 'Not Applicable';
  isInconsistent: boolean;
  inconsistencyError?: string;
  explanation: string;
}

export interface DeliveryReconciliationSummary {
  quotationId: string;
  quotationCode?: string;
  hasPhysicalInventory: boolean;
  hasPendingShipments: boolean;
  hasInconsistencies: boolean;
  totalOrderedPhysicalUnits: number;
  totalShippedPhysicalUnits: number;
  totalInvoicedPhysicalUnits: number;
  totalPendingPhysicalUnits: number;
  items: DeliveryReconciliationItem[];
}

export type DealHealthType =
  | 'stalled'
  | 'discount_anomaly'
  | 'delivery_slippage'
  | 'approval_delay'
  | 'margin_risk'
  | 'negotiation_risk'
  // Legacy aliases
  | 'stalled_deal'
  | 'Stalled'
  | 'DiscountAnomaly'
  | 'DeliverySlippage';

export type DealHealthSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface DealHealthEvidence {
  // Stalled evidence
  lastActivityAt?: string;
  inactivityDays?: number;
  configuredThresholdDays?: number;
  // Discount anomaly evidence
  repName?: string;
  repId?: string;
  repHistoricalAvgDiscount?: number;
  currentDealDiscount?: number;
  differencePts?: number;
  thresholdSpreadPts?: number;
  // Delivery slippage evidence
  requestedDeliveryDate?: string;
  totalOrderedUnits?: number;
  shippedUnits?: number;
  remainingUnits?: number;
  backorderedUnits?: number;
  depotAvailabilityNote?: string;
  daysUntilDelivery?: number;
}

export interface DealHealthFlag {
  id: string;
  quotationId: string;
  quotationCode?: string;
  customerName?: string;
  salesRepId?: string;
  salesRepName?: string;
  stage?: string;
  grandTotal?: number;
  type: DealHealthType;
  severity: DealHealthSeverity;
  reason?: string;
  detail: string;
  details?: string; // alias for detail
  metricValue?: number | string;
  threshold?: number | string;
  recommendedAction?: string;
  evidence?: DealHealthEvidence;
  flaggedDate: string;
  flaggedAt?: string; // legacy alias
  actionTaken?: string;
  isResolved?: boolean;
  resolvedAt?: string;
  resolvedReason?: string;
  // Action state
  isEscalated?: boolean;
  escalationReason?: string;
  escalatedAt?: string;
  escalatedBy?: string;
  lastNudgedAt?: string;
  lastNudgedBy?: string;
  nudgeCount?: number;
  lastNudgeMessage?: string;
}

export interface RecentDealHealthAction {
  id: string;
  quotationId: string;
  quotationCode: string;
  customerName?: string;
  actionType: 'nudge' | 'escalate' | 'resolved';
  actorName: string;
  targetRepName?: string;
  summary: string;
  detail?: string;
  timestamp: string;
}

export interface DealHealthEvaluation {
  score: number;
  level: 'HEALTHY' | 'WATCH' | 'AT_RISK' | 'CRITICAL';
  factors: { name: string; weight: number; contribution: number; detail: string }[];
  recommendations: string[];
}

export interface TimelineEvent {
  id: string;
  quotationId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  eventType: string;
  timestamp: string;
  note: string;
  metadata?: Record<string, unknown>;
}

// Legacy alias
export type DealEvent = TimelineEvent;

export interface NegotiationRequest {
  id: string;
  quotationId: string;
  customerId: string;
  customerName?: string;
  authorName?: string;
  authorRole?: string;
  lineId?: string;
  type: 'line_change' | 'discount_counter' | 'question' | 'general_change';
  requestedDiscount?: number;
  counterDiscountPercent?: number; // legacy alias
  requestedDeliveryDate?: string;
  message: string;
  comment?: string; // legacy alias
  response?: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn' | 'UnderReview';
  createdAt: string;
  submittedAt?: string; // legacy alias
  respondedAt?: string;
}

export interface UpsellSuggestion {
  id?: string;
  productId: string;
  productName?: string;
  targetCategory?: ProductCategory;
  reason: string;
  marginDelta: number;
  promotion?: boolean;
  isPromoted?: boolean; // legacy alias
  priority: number;
}

export type ReportPeriod =
  | 'Last7Days'
  | 'Last30Days'
  | 'LastQuarter'
  | 'YearToDate'
  | 'AllTime'
  | 'Custom';

export interface ReportFilters {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  salesTeam?: string; // e.g. 'All' or specific department
  repId?: string; // 'All' or specific user ID
  stage?: string; // 'All' or specific QuotationStage
  approvalStatus?: string; // 'All' | 'Pending' | 'Approved' | 'Rejected'
  category?: string; // 'All' | 'Hardware' | 'Services' | 'Subscription'
  customerTier?: string; // 'All' | 'Bronze' | 'Silver' | 'Gold'
  searchQuery?: string;
}

// Alias for backwards compatibility
export type ReportFilter = ReportFilters;

export interface ReportKPIs {
  quotesCreated: number;
  totalPipelineValue: number;
  averageApprovalTimeHours: number;
  topUpsoldProduct: string;
  topUpsoldCount: number;
  blendedMarginRate: number;
  approvedCount: number;
  pendingApprovalCount: number;
  rejectedCount: number;
  averageDiscountPercent: number;
  wonRatePercent: number;
}

export interface CategoryReportItem {
  category: ProductCategory;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  revenueSharePercent: number;
}

export interface RepPerformanceItem {
  repId: string;
  repName: string;
  department: string;
  quotesCount: number;
  pipelineValue: number;
  averageDealSize: number;
  averageDiscountPercent: number;
  blendedMarginPercent: number;
  approvedCount: number;
  winRatePercent: number;
}

export interface ApprovalPerformanceItem {
  stepId: string;
  quotationId: string;
  quotationCode: string;
  customerName: string;
  stepOrder: number;
  approverRole: string;
  approverName: string;
  status: string;
  submittedAt: string;
  decidedAt?: string;
  turnaroundHours: number;
  maxDiscountOverLimit: number;
  note?: string;
}

export interface StagePipelineItem {
  stage: QuotationStage;
  count: number;
  value: number;
  averageMargin: number;
}

// ==========================================
// BACKEND CONFIGURATION MODELS
// ==========================================

export interface PriceListItem {
  productId: string;
  productName?: string;
  customPrice: number;
}

export interface PriceList {
  id: string;
  name: string;
  tier: CustomerTier;
  currency: string;
  items: PriceListItem[];
  validFrom?: string;
  validTo?: string;
  active: boolean;
  notes?: string;
}

export interface UpsellRule {
  id: string;
  name: string;
  triggerProductId: string;
  triggerProductName?: string;
  recommendedProductId: string;
  recommendedProductName?: string;
  reason: string;
  promoted: boolean;
  priority: number;
  active: boolean;
  minDealValue?: number;
}

export interface ReportingConfiguration {
  defaultPeriod: 'Last30Days' | 'LastQuarter' | 'YearToDate' | 'AllTime';
  visibleKpis: string[];
  companyHeader: string;
  tagline: string;
  includeAuditorNotes: boolean;
}

export interface ConfigAuditEvent {
  id: string;
  category:
    | 'products'
    | 'price_lists'
    | 'discount_tiers'
    | 'approval_chains'
    | 'warehouses'
    | 'subscription_plans'
    | 'upsell_rules'
    | 'reporting';
  recordName: string;
  recordId?: string;
  action: 'create' | 'update' | 'archive' | 'activate' | 'deactivate';
  actorName: string;
  actorRole: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
}

// ============================================================================
// REAL BACKEND ENTITIES
// ============================================================================
// The types above model the legacy mock/localStorage store's richer,
// UI-computed Quotation/Invoice shapes. SalesOrder has no mock-store
// equivalent — it is a real, distinct entity on the backend (see
// backend/src/modules/sales-orders/sales-orders.model.ts), created only via
// POST /quotations/:id/convert. Its field names intentionally mirror the
// backend's snake_case column names (all monetary values are decimal
// strings, as Postgres numeric columns are serialized) rather than being
// forced into the mock model's camelCase/number conventions, so a value
// from the API can be used here without silent precision loss or a
// mapping layer masking what the server actually returned.
export type SalesOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
  total: string;
  fulfilled_quantity: string;
  backordered_quantity: string;
  created_at: string;
  updated_at: string;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  quotation_id: string;
  customer_id: string;
  sales_rep_id: string;
  status: SalesOrderStatus;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  order_date: string;
  created_at: string;
  updated_at: string;
  /** Present on GET /sales-orders/:id; absent on the GET /sales-orders list. */
  items?: SalesOrderItem[];
}


