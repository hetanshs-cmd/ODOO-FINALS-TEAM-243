/**
 * DealFlow360 — Service Layer (real backend)
 *
 * Every service below calls the live Express/TS backend under /api/v1 via
 * httpClient, per docs in this repo's onboarding task and the route files
 * under backend/src/modules/*. Method NAMES are kept stable wherever the
 * original mock-backed service exposed an equivalent operation, but several
 * return/parameter shapes necessarily changed: the real backend's entities
 * (see backend/src/modules/**\/*.model.ts, mirrored in ./apiTypes.ts) are
 * flatter and differently-shaped than the legacy mock store's rich,
 * UI-computed Quotation/Invoice/Subscription objects (frontend/src/types).
 * Pages that still read business data via useDealStore/the mock types are
 * NOT wired to these calls yet — see the migration note in the PR/commit
 * description for what remains.
 *
 * Kept untouched per instructions: ./ai/aiService.ts and ./reportingExport.ts.
 */

import { httpClient, ApiError } from './httpClient';
import {
  ApiQuotation,
  ApiQuotationWithItems,
  CreateQuotationInput,
  UpdateQuotationInput,
  CreateQuotationItemInput,
  ApiApprovalRequest,
  ApiApprovalAction,
  ApiFulfillment,
  ApiInvoice,
  ApiPayment,
  RecordPaymentInput,
  ApiSubscription,
  ApiNegotiation,
  ApiNegotiationMessage,
  AddNegotiationMessageInput,
  ApiDealHealthScore,
  ApiDealAlert,
  ApiNotification,
  ApiRecommendation,
  ApiSalesSummary,
  ApiDiscountExceptions,
  ListQuery,
} from './apiTypes';
import { SalesOrder } from '../types';
import { adminService, isForbiddenError } from './adminService';

export { authService } from './authService';
export { adminService, isForbiddenError } from './adminService';
export * from './apiTypes';

// Still backed by the mock store — kept for the client-side domain
// calculations/permission model used across the (not-yet-migrated) pages.
// See the top-of-file note: these are independent of the API rewire below.
import { dealStore } from '../store/dealStore';
import { getEffectiveDiscountLimit, computeLineStatus, computeBlendedRiskScore } from '../domain/discounts';
import { computeWarehouseSplit } from '../domain/fulfillment';
import { canUserPerformAction, ActionType } from '../domain/permissions';
import {
  User,
  DiscountTierRule,
  CategoryDiscountRule,
  Warehouse,
  WarehouseSplitResult,
  TimelineEvent,
} from '../types';

// 1. QUOTATION SERVICE (GET/POST /quotations, GET/PATCH /quotations/:id,
//    POST /quotations/:id/items, POST /quotations/:id/check-discounts,
//    POST /quotations/:id/convert)
export const quotationService = {
  async getAll(query?: ListQuery): Promise<ApiQuotation[]> {
    return httpClient.get<ApiQuotation[]>('/quotations', { query });
  },
  async getById(id: string): Promise<ApiQuotationWithItems> {
    return httpClient.get<ApiQuotationWithItems>(`/quotations/${id}`);
  },
  async create(data: CreateQuotationInput): Promise<ApiQuotation> {
    // sales_rep_id is derived server-side from the auth token — never sent.
    return httpClient.post<ApiQuotation>('/quotations', data);
  },
  async update(id: string, data: UpdateQuotationInput): Promise<ApiQuotation> {
    return httpClient.patch<ApiQuotation>(`/quotations/${id}`, data);
  },
  async addItem(quotationId: string, item: CreateQuotationItemInput): Promise<ApiQuotationWithItems> {
    return httpClient.post<ApiQuotationWithItems>(`/quotations/${quotationId}/items`, item);
  },
  async checkDiscounts(quotationId: string): Promise<unknown> {
    return httpClient.post(`/quotations/${quotationId}/check-discounts`);
  },
  /** Converts a quotation into a real SalesOrder. id comes from the URL, no body. */
  async convert(quotationId: string): Promise<SalesOrder> {
    return httpClient.post<SalesOrder>(`/quotations/${quotationId}/convert`);
  },
};

// 2. APPROVAL SERVICE (GET /approvals, GET /approvals/:id, POST /approvals/:id/act)
export const approvalService = {
  async getAll(query?: ListQuery): Promise<ApiApprovalRequest[]> {
    return httpClient.get<ApiApprovalRequest[]>('/approvals', { query });
  },
  async getById(id: string): Promise<ApiApprovalRequest> {
    return httpClient.get<ApiApprovalRequest>(`/approvals/${id}`);
  },
  /** user_id is derived server-side from the auth token — never sent. */
  async act(id: string, action: ApiApprovalAction, comment?: string): Promise<ApiApprovalRequest> {
    return httpClient.post<ApiApprovalRequest>(`/approvals/${id}/act`, { action, comment });
  },
};

// 3. SALES ORDER SERVICE (new — real, distinct entity; GET /sales-orders, GET /sales-orders/:id)
export const salesOrderService = {
  async getAll(query?: ListQuery): Promise<SalesOrder[]> {
    return httpClient.get<SalesOrder[]>('/sales-orders', { query });
  },
  async getById(id: string): Promise<SalesOrder> {
    return httpClient.get<SalesOrder>(`/sales-orders/${id}`);
  },
};

// 4. FULFILLMENT SERVICE
export const fulfillmentService = {
  async suggestFulfillment(salesOrderId: string): Promise<ApiFulfillment> {
    return httpClient.post<ApiFulfillment>(`/sales-orders/${salesOrderId}/suggest-fulfillment`);
  },
  async listForSalesOrder(salesOrderId: string): Promise<ApiFulfillment[]> {
    return httpClient.get<ApiFulfillment[]>(`/sales-orders/${salesOrderId}/fulfillments`);
  },
  async getById(fulfillmentId: string): Promise<ApiFulfillment> {
    return httpClient.get<ApiFulfillment>(`/fulfillments/${fulfillmentId}`);
  },
  async ship(fulfillmentId: string): Promise<ApiFulfillment> {
    return httpClient.post<ApiFulfillment>(`/fulfillments/${fulfillmentId}/ship`);
  },
};

// Legacy warehouse/split helpers used by (not-yet-migrated) fulfillment UI.
// computeSplit is a pure client-side estimate; there is no backend
// equivalent besides fulfillmentService.suggestFulfillment above, which
// actually allocates against real warehouse stock server-side.
export const warehouseService = {
  async getAll(): Promise<Warehouse[]> {
    // /admin/warehouses is ADMIN-gated; non-admins fall back to mock data
    // that still ships with the app until warehouse listing is exposed
    // to other roles.
    try {
      return (await adminService.warehouses.list()) as unknown as Warehouse[];
    } catch (err) {
      if (isForbiddenError(err)) {
        return dealStore.getState().warehouses;
      }
      throw err;
    }
  },
  async computeSplit(lines: any[]): Promise<WarehouseSplitResult> {
    return computeWarehouseSplit(lines, dealStore.getState().warehouses);
  },
  // TODO: no backend endpoint exists yet for accepting/overriding a
  // client-computed split, or for consolidating a backorder — the real
  // flow is fulfillmentService.suggestFulfillment + .ship. Left as
  // UI-safe no-ops (rather than silent mock writes) until that lands.
  async acceptSplit(_quotationId: string, _split: WarehouseSplitResult): Promise<void> {
    console.warn('warehouseService.acceptSplit: no backend endpoint yet — no-op.');
  },
  async overrideSplit(_quotationId: string, _allocations: unknown[]): Promise<void> {
    console.warn('warehouseService.overrideSplit: no backend endpoint yet — no-op.');
  },
  async consolidateBackorder(): Promise<void> {
    console.warn('warehouseService.consolidateBackorder: no backend endpoint yet — no-op.');
  },
};

// 5. BILLING SERVICE (POST /sales-orders/:id/billing/confirm, GET /invoices,
//    GET /invoices/:id, GET/POST /invoices/:id/payments)
export const billingService = {
  async confirmBilling(salesOrderId: string, planId?: string): Promise<unknown> {
    return httpClient.post(`/sales-orders/${salesOrderId}/billing/confirm`, planId ? { plan_id: planId } : {});
  },
  async getInvoices(query?: ListQuery): Promise<ApiInvoice[]> {
    return httpClient.get<ApiInvoice[]>('/invoices', { query });
  },
  async getInvoiceById(id: string): Promise<ApiInvoice> {
    return httpClient.get<ApiInvoice>(`/invoices/${id}`);
  },
  async listPayments(invoiceId: string): Promise<ApiPayment[]> {
    return httpClient.get<ApiPayment[]>(`/invoices/${invoiceId}/payments`);
  },
  async recordPayment(invoiceId: string, data: RecordPaymentInput): Promise<ApiPayment> {
    return httpClient.post<ApiPayment>(`/invoices/${invoiceId}/payments`, data);
  },
};

// 6. SUBSCRIPTION SERVICE
// Plan definitions are admin-owned config (/admin/subscription-plans).
// Customer-facing modify/cancel use the two endpoints a `backend`-branch
// teammate is adding concurrently (see task notes): PATCH /subscriptions/:id
// and POST /subscriptions/:id/cancel. They may 404 until that branch merges
// — that's expected, not a bug in this wiring.
export const subscriptionService = {
  plans: adminService.subscriptionPlans,
  // TODO: no GET /subscriptions (list) endpoint is documented in the
  // current contract. Left unavailable rather than silently returning
  // mock rows.
  async getAll(): Promise<ApiSubscription[]> {
    console.warn('subscriptionService.getAll: no backend list endpoint documented yet.');
    return [];
  },
  async modify(id: string, updates: Partial<ApiSubscription>): Promise<ApiSubscription> {
    return httpClient.patch<ApiSubscription>(`/subscriptions/${id}`, updates);
  },
  async cancel(
    id: string,
    options?: { reason?: string; effectiveDate?: string }
  ): Promise<ApiSubscription> {
    return httpClient.post<ApiSubscription>(`/subscriptions/${id}/cancel`, options || {});
  },
};

// 7. DEAL HEALTH SERVICE
export const dealHealthService = {
  async getForQuotation(quotationId: string): Promise<ApiDealHealthScore> {
    return httpClient.get<ApiDealHealthScore>(`/quotations/${quotationId}/deal-health`);
  },
  async recalculate(quotationId: string): Promise<ApiDealHealthScore> {
    return httpClient.post<ApiDealHealthScore>(`/quotations/${quotationId}/deal-health/recalculate`);
  },
  async listAlerts(query?: ListQuery): Promise<ApiDealAlert[]> {
    return httpClient.get<ApiDealAlert[]>('/deal-health', { query });
  },
  async actOnAlert(alertId: string, status: 'ESCALATED' | 'NUDGED' | 'RESOLVED'): Promise<ApiDealAlert> {
    return httpClient.post<ApiDealAlert>(`/deal-health/${alertId}`, { status });
  },
};

// 8. NEGOTIATION SERVICE (POST /quotations/:id/negotiations, GET
//    /negotiations/:id, POST /negotiations/:id/messages)
export const negotiationService = {
  async open(quotationId: string): Promise<ApiNegotiation> {
    return httpClient.post<ApiNegotiation>(`/quotations/${quotationId}/negotiations`);
  },
  async getById(negotiationId: string): Promise<ApiNegotiation & { messages?: ApiNegotiationMessage[] }> {
    return httpClient.get(`/negotiations/${negotiationId}`);
  },
  async addMessage(negotiationId: string, data: AddNegotiationMessageInput): Promise<ApiNegotiationMessage> {
    return httpClient.post<ApiNegotiationMessage>(`/negotiations/${negotiationId}/messages`, data);
  },
};

// 9. NOTIFICATIONS SERVICE (new)
export const notificationsService = {
  async getAll(query?: ListQuery): Promise<ApiNotification[]> {
    return httpClient.get<ApiNotification[]>('/notifications', { query });
  },
  async markRead(id: string): Promise<ApiNotification> {
    return httpClient.patch<ApiNotification>(`/notifications/${id}/read`);
  },
};

// 10. PRODUCT / UPSELL SERVICE
export const productService = {
  // /admin/products is the only product listing endpoint currently exposed
  // (ADMIN-gated); non-admin roles get a clean 403 rather than a crash.
  async getAll() {
    return adminService.products.list();
  },
  async getById(id: string) {
    return adminService.products.getById(id);
  },
  async getRecommendations(productId: string, query?: { type?: 'UPSELL' | 'CROSS_SELL'; min_margin_percent?: number }): Promise<ApiRecommendation[]> {
    return httpClient.get<ApiRecommendation[]>(`/products/${productId}/recommendations`, { query });
  },
};

// 11. REPORTING (backend-backed; distinct from the mock-backed reportingService below)
export const reportingBackendService = {
  async salesSummary(query?: ListQuery): Promise<ApiSalesSummary> {
    return httpClient.get<ApiSalesSummary>('/reports/sales-summary', { query });
  },
  async discountExceptions(query?: ListQuery): Promise<ApiDiscountExceptions> {
    return httpClient.get<ApiDiscountExceptions>('/reports/discount-exceptions', { query });
  },
};

// ============================================================================
// Client-side-only domain helpers (unchanged) — pure calculations reused by
// pages still on the mock store. Not part of the backend contract.
// ============================================================================

export const discountService = {
  getRules(): { tiers: DiscountTierRule[]; categories: CategoryDiscountRule[] } {
    const s = dealStore.getState();
    return { tiers: s.discountTiers, categories: s.categoryCeilings };
  },
  validateDiscount(category: any, tier: any, discount: number) {
    const s = dealStore.getState();
    const { effectiveLimit, governingRule } = getEffectiveDiscountLimit(
      category,
      tier,
      s.categoryCeilings,
      s.discountTiers
    );
    const { status, overBy } = computeLineStatus(discount, effectiveLimit);
    return { effectiveLimit, governingRule, status, overBy };
  },
  evaluateRisk(lines: any[]) {
    return computeBlendedRiskScore(lines);
  },
};

export const permissionService = {
  can(user: User, action: ActionType, resource?: any) {
    return canUserPerformAction(user, action, resource);
  },
};

export const timelineService = {
  async getForQuotation(quotationId: string): Promise<TimelineEvent[]> {
    return dealStore.getState().timelineEvents.filter((e) => e.quotationId === quotationId);
  },
  log(quotationId: string, eventType: string, note: string, metadata?: Record<string, unknown>) {
    return dealStore.logTimelineEvent(quotationId, eventType, note, metadata);
  },
};

// Customer Portal service — the only portal-scoped resource route beyond
// auth today is negotiations (POST /quotations/:id/negotiations falls back
// to portal auth — see backend/src/modules/negotiations/negotiations.routes.ts).
// There is no GET endpoint yet for a customer's own quotations/orders, so
// that part of the portal UI has no live data source until one exists.
export const customerPortalService = {
  negotiations: negotiationService,
};

import { reportingService } from './reportingService';
export { reportingService };
export { exportReportToPDF, exportReportToXLS } from './reportingExport';

// Backward-compatible flat `api` adapter. Re-pointed to the real services
// above wherever an equivalent endpoint exists; left as a clearly-marked
// TODO + UI-safe fallback where nothing exists server-side yet.
export const api = {
  getQuotations: quotationService.getAll,
  getQuotation: quotationService.getById,
  createQuotation: quotationService.create,
  updateQuotation: quotationService.update,
  getApprovals: approvalService.getAll,
  getApproval: approvalService.getById,
  actOnApproval: (id: string, action: ApiApprovalAction, comment?: string) =>
    approvalService.act(id, action, comment),
  getSalesOrders: salesOrderService.getAll,
  getSalesOrder: salesOrderService.getById,
  getWarehouses: warehouseService.getAll,
  // TODO: no backend endpoint for raw per-SKU stock levels is documented
  // yet — surfaced as an explicit "unavailable" result rather than a
  // silent empty array pretending to be real data.
  getStockLevels: async (): Promise<{ unavailable: true; reason: string }> => ({
    unavailable: true,
    reason: 'Stock level lookup is not yet exposed by the backend API.',
  }),
  getFulfillmentSplit: fulfillmentService.listForSalesOrder,
  applyFulfillmentOverride: warehouseService.overrideSplit,
  getSubscriptionPlans: adminService.subscriptionPlans.list,
  getInvoices: billingService.getInvoices,
  getInvoice: billingService.getInvoiceById,
  recordPayment: billingService.recordPayment,
  submitNegotiation: negotiationService.open,
  confirmQuotation: quotationService.convert,
  getDealHealthAlerts: dealHealthService.listAlerts,
  // Was `resolveDealHealthFlag(id)` with no real action — now maps onto the
  // real "act on a deal-health alert" endpoint with an explicit status.
  resolveDealHealthFlag: (alertId: string) => dealHealthService.actOnAlert(alertId, 'RESOLVED'),
  getReports: reportingBackendService.salesSummary,
};

export * from './ai/types';
export { aiService } from './ai/aiService';
