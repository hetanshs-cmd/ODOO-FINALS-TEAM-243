/**
 * DealFlow360 — Service Layer
 * Clean, decoupled enterprise services that bridge components to domain engines and store.
 * Ready for drop-in REST/GraphQL backend replacement.
 */

import { dealStore } from '../store/dealStore';
import {
  Quotation,
  Product,
  Customer,
  Warehouse,
  Subscription,
  Invoice,
  NegotiationRequest,
  DealHealthFlag,
  TimelineEvent,
  ApprovalStep,
  WarehouseSplitAllocation,
  WarehouseSplitResult,
  User,
  DiscountTierRule,
  CategoryDiscountRule,
} from '../types';

import { getEffectiveDiscountLimit, computeLineStatus, computeBlendedRiskScore } from '../domain/discounts';
import { computeWarehouseSplit, validateWarehouseOverride } from '../domain/fulfillment';
import { getUpsellSuggestions } from '../domain/recommendations';
import { buildBillingRecord, computeProration } from '../domain/billing';
import { computeDealHealthScore } from '../domain/deal-health';
import { canUserPerformAction, ActionType } from '../domain/permissions';
import { getCustomerVisibleQuotation, CustomerVisibleQuotation } from '../domain/customer-portal';
export { authService } from './authService';

// 1. QUOTATION SERVICE
export const quotationService = {
  async getAll(): Promise<Quotation[]> {
    return dealStore.getState().quotations;
  },
  async getById(id: string): Promise<Quotation | null> {
    const q = dealStore.getState().quotations.find((item) => item.id === id || item.code === id);
    return q || null;
  },
  async create(data: Partial<Quotation>): Promise<Quotation> {
    return dealStore.createQuotation(data);
  },
  async update(id: string, data: Partial<Quotation>): Promise<Quotation> {
    return dealStore.updateQuotation(id, data);
  },
  async addLine(quotationId: string, productId: string, qty = 1, discount = 0): Promise<Quotation> {
    return dealStore.addQuotationLine(quotationId, productId, qty, discount);
  },
  async removeLine(quotationId: string, lineId: string): Promise<Quotation> {
    return dealStore.removeQuotationLine(quotationId, lineId);
  },
  async updateLineQuantity(quotationId: string, lineId: string, qty: number): Promise<Quotation> {
    return dealStore.updateLineQuantity(quotationId, lineId, qty);
  },
  async updateLineDiscount(quotationId: string, lineId: string, discount: number): Promise<Quotation> {
    return dealStore.updateLineDiscount(quotationId, lineId, discount);
  },
  async addUpsell(quotationId: string, productId: string): Promise<Quotation> {
    return dealStore.addUpsellToQuotation(quotationId, productId);
  },
  async dismissUpsell(quotationId: string, productId: string): Promise<void> {
    dealStore.dismissUpsell(quotationId, productId);
  },
  async getUpsellsForQuote(quotation: Quotation): Promise<ReturnType<typeof getUpsellSuggestions>> {
    const state = dealStore.getState();
    const dismissed = state.dismissedUpsellIds[quotation.id] || [];
    return getUpsellSuggestions(quotation, state.products, dismissed);
  },
};

// 2. APPROVAL SERVICE
export const approvalService = {
  async getPending(): Promise<Quotation[]> {
    return dealStore
      .getState()
      .quotations.filter((q) => q.stage === 'Pending Approval' || q.stage === 'PendingApproval');
  },
  async getStepsForQuote(quotationId: string): Promise<ApprovalStep[]> {
    return dealStore.getState().approvalSteps.filter((s) => s.quotationId === quotationId);
  },
  async submit(quotationId: string, note?: string): Promise<Quotation> {
    return dealStore.submitQuotationForApproval(quotationId, note);
  },
  async approve(quotationId: string, note?: string): Promise<Quotation> {
    return dealStore.approveQuotation(quotationId, note);
  },
  async returnForRevision(quotationId: string, note: string): Promise<Quotation> {
    return dealStore.returnQuotation(quotationId, note);
  },
  async reject(quotationId: string, note: string): Promise<Quotation> {
    return dealStore.rejectQuotation(quotationId, note);
  },
};

// 3. PRODUCT SERVICE
export const productService = {
  async getAll(): Promise<Product[]> {
    return dealStore.getState().products;
  },
  async getById(id: string): Promise<Product | null> {
    return dealStore.getState().products.find((p) => p.id === id) || null;
  },
};

// 4. DISCOUNT SERVICE
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

// 5. WAREHOUSE & FULFILLMENT SERVICE
export const warehouseService = {
  async getAll(): Promise<Warehouse[]> {
    return dealStore.getState().warehouses;
  },
  async computeSplit(lines: any[]): Promise<WarehouseSplitResult> {
    return computeWarehouseSplit(lines, dealStore.getState().warehouses);
  },
  async acceptSplit(quotationId: string, split: WarehouseSplitResult): Promise<void> {
    dealStore.acceptWarehouseSplit(quotationId, split);
  },
  async overrideSplit(quotationId: string, allocations: WarehouseSplitAllocation[]): Promise<void> {
    dealStore.overrideWarehouseSplit(quotationId, allocations);
  },
  async consolidateBackorder(
    quotationId: string,
    productId: string,
    arrivedQty: number,
    targetWarehouseId: string
  ): Promise<void> {
    dealStore.consolidateBackorderAction(quotationId, productId, arrivedQty, targetWarehouseId);
  },
};

// 6. BILLING SERVICE
export const billingService = {
  getBillingRecord(quotation: Quotation) {
    return buildBillingRecord(quotation);
  },
  calculateProration(prevAmount: number, newAmount: number, remDays: number, totalDays: number) {
    return computeProration(prevAmount, newAmount, remDays, totalDays);
  },
  async getInvoices(): Promise<Invoice[]> {
    return dealStore.getState().invoices;
  },
  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    return dealStore.createInvoice(data);
  },
  async recordPayment(invoiceId: string): Promise<Invoice> {
    return dealStore.recordPayment(invoiceId);
  },
};

// 7. SUBSCRIPTION SERVICE
export const subscriptionService = {
  async getAll(): Promise<Subscription[]> {
    return dealStore.getState().subscriptions;
  },
  async create(data: Partial<Subscription>): Promise<Subscription> {
    return dealStore.createSubscription(data);
  },
  async modify(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const res = dealStore.modifySubscription(id, updates);
    return res.subscription;
  },
  async cancel(
    id: string,
    options?:
      | {
          reason?: string;
          effectiveDate?: string;
          refundPolicy?: 'prorated_credit' | 'full_credit' | 'no_refund';
          usedDays?: number;
          totalDays?: number;
        }
      | number,
    totalDays?: number
  ) {
    if (typeof options === 'number') {
      return dealStore.cancelSubscription(id, { usedDays: options, totalDays });
    }
    return dealStore.cancelSubscription(id, options);
  },
};

// 8. DEAL HEALTH SERVICE
export const dealHealthService = {
  async getFlags(): Promise<DealHealthFlag[]> {
    return dealStore.getState().dealHealthFlags;
  },
  evaluateQuotation(quotation: Quotation) {
    return computeDealHealthScore(quotation);
  },
};

// 9. NEGOTIATION SERVICE
export const negotiationService = {
  async getForQuotation(quotationId: string): Promise<NegotiationRequest[]> {
    return dealStore.getState().negotiations.filter((n) => n.quotationId === quotationId);
  },
  async createRequest(quotationId: string, data: Partial<NegotiationRequest>): Promise<NegotiationRequest> {
    return dealStore.createNegotiationRequest(quotationId, data);
  },
  async resolve(
    quotationId: string,
    negotiationId: string,
    action: 'accept' | 'counter' | 'reject',
    counterDiscount?: number
  ): Promise<Quotation> {
    return dealStore.applyNegotiationChange(quotationId, negotiationId, action, counterDiscount);
  },
};

// 10. PERMISSION SERVICE
export const permissionService = {
  can(user: User, action: ActionType, resource?: any) {
    return canUserPerformAction(user, action, resource);
  },
};

// 11. TIMELINE SERVICE
export const timelineService = {
  async getForQuotation(quotationId: string): Promise<TimelineEvent[]> {
    return dealStore.getState().timelineEvents.filter((e) => e.quotationId === quotationId);
  },
  log(quotationId: string, eventType: string, note: string, metadata?: Record<string, unknown>) {
    return dealStore.logTimelineEvent(quotationId, eventType, note, metadata);
  },
};

// Customer Portal service
export const customerPortalService = {
  getRestrictedQuotation(quotation: Quotation, customerId?: string): CustomerVisibleQuotation | null {
    return getCustomerVisibleQuotation(quotation, customerId);
  },
};

import { reportingService } from './reportingService';
export { reportingService };
export { exportReportToPDF, exportReportToXLS } from './reportingExport';

// Backward-compatible api adapter
export const api = {
  getUsers: async () => dealStore.getState().users,
  getCurrentUser: async () => dealStore.getState().currentUser,
  getCustomers: async () => dealStore.getState().customers,
  getCustomer: async (id: string) => dealStore.getState().customers.find((c) => c.id === id) || null,
  getProduct: productService.getById,
  getProducts: productService.getAll,
  getQuotations: quotationService.getAll,
  getQuotation: quotationService.getById,
  createQuotation: quotationService.create,
  updateQuotation: quotationService.update,
  getApprovals: approvalService.getPending,
  getApproval: async (id: string) => {
    const quotation = await quotationService.getById(id);
    if (!quotation) return null;
    const steps = await approvalService.getStepsForQuote(quotation.id);
    return { quotation, steps };
  },
  submitForApproval: approvalService.submit,
  actOnApproval: async (id: string, action: string, note: string) => {
    if (action === 'Approved') return approvalService.approve(id, note);
    if (action === 'Rejected') return approvalService.reject(id, note);
    return approvalService.returnForRevision(id, note);
  },
  getWarehouses: warehouseService.getAll,
  getStockLevels: async () => [],
  getFulfillmentSplit: async (id: string) => [],
  applyFulfillmentOverride: async (id: string, splits: any[]) => [],
  getSubscriptions: subscriptionService.getAll,
  getSubscription: async (id: string) => dealStore.getState().subscriptions.find((s) => s.id === id) || null,
  getInvoices: billingService.getInvoices,
  getInvoice: async (id: string) => dealStore.getState().invoices.find((i) => i.id === id) || null,
  recordPayment: billingService.recordPayment,
  submitNegotiation: async (quotationId: string, req: any) => dealStore.createNegotiationRequest(quotationId, req),
  confirmQuotation: async (id: string) => dealStore.updateQuotation(id, { stage: 'Confirmed' }),
  getDealHealthFlags: dealHealthService.getFlags,
  resolveDealHealthFlag: async (id: string) => {},
  getReports: async (filters?: any) => {
    const defaultFilters = { period: 'AllTime' as const };
    const res = reportingService.getReportData(filters || defaultFilters);
    return res.kpis;
  },
};

export * from './ai/types';
export { aiService } from './ai/aiService';
