/**
 * DealFlow360 Master Application Store
 * Centralized, typed, reactive, deterministic, and stateful application engine.
 * Automatically synchronizes with browser localStorage and orchestrates connected domain calculations.
 */

import {
  User,
  Customer,
  Product,
  Warehouse,
  DiscountTierRule,
  CategoryDiscountRule,
  ApprovalChainRule,
  Quotation,
  QuotationLine,
  ApprovalStep,
  WarehouseSplitAllocation,
  WarehouseSplitResult,
  SubscriptionPlan,
  Subscription,
  Invoice,
  InvoiceStatus,
  DeliveryStage,
  PaymentRecord,
  InvoiceAuditEntry,
  NegotiationRequest,
  DealHealthFlag,
  UpsellSuggestion,
  TimelineEvent,
  UserRole,
  CreditNote,
  ProrationEvent,
  SubscriptionBillingConfig,
  PriceList,
  UpsellRule,
  ReportingConfiguration,
  ConfigAuditEvent,
  CustomerTier,
  ProductCategory,
} from '../types';

import {
  SEED_USERS,
  SEED_CUSTOMERS,
  SEED_PRODUCTS,
  SEED_WAREHOUSES,
  SEED_DISCOUNT_TIERS,
  SEED_CATEGORY_CEILINGS,
  SEED_APPROVAL_RULES,
  SEED_SUBSCRIPTION_PLANS,
  SEED_QUOTATIONS,
  SEED_APPROVAL_STEPS,
  SEED_SUBSCRIPTIONS,
  SEED_INVOICES,
  SEED_NEGOTIATION_REQUESTS,
  SEED_DEAL_HEALTH_FLAGS,
  SEED_UPSELL_SUGGESTIONS,
  SEED_TIMELINE_EVENTS,
  SEED_CREDIT_NOTES,
  SEED_PRORATION_EVENTS,
  SEED_PRICE_LISTS,
  SEED_UPSELL_RULES,
  SEED_REPORTING_CONFIG,
  SEED_CONFIG_AUDIT_TRAIL,
} from '../data/seedData';

import {
  computeLineStatus,
  getEffectiveDiscountLimit,
  computeBlendedRiskScore,
  computeRequiredApprovers,
} from '../domain/discounts';

import { computeMarginDelta, computeQuotationTotals } from '../domain/margin';
import { computeWarehouseSplit, validateWarehouseOverride, consolidateBackorder } from '../domain/fulfillment';
import {
  buildBillingRecord,
  computeProration,
  computeCancellationAdjustment,
  calculateProration,
  calculateCancellationRefund,
} from '../domain/billing';
import { computeDealHealthScore } from '../domain/deal-health';
import { canUserPerformAction } from '../domain/permissions';

const STORAGE_KEY = 'dealflow360_store_v4';

export interface DealStoreState {
  currentUser: User;
  isAuthenticated: boolean;
  selectedTeam?: string;
  users: User[];
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  discountTiers: DiscountTierRule[];
  categoryCeilings: CategoryDiscountRule[];
  approvalRules: ApprovalChainRule[];
  quotations: Quotation[];
  approvalSteps: ApprovalStep[];
  subscriptionPlans: SubscriptionPlan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  negotiations: NegotiationRequest[];
  dealHealthFlags: DealHealthFlag[];
  upsellSuggestions: UpsellSuggestion[];
  timelineEvents: TimelineEvent[];
  creditNotes: CreditNote[];
  prorationEvents: ProrationEvent[];
  subscriptionBillingConfig: SubscriptionBillingConfig;
  priceLists: PriceList[];
  upsellRules: UpsellRule[];
  reportingConfig: ReportingConfiguration;
  configAuditTrail: ConfigAuditEvent[];
  dismissedUpsellIds: Record<string, string[]>; // quotationId -> dismissed productIds
  activeFulfillmentSplits: Record<string, WarehouseSplitResult>; // quotationId -> split result
  lastRefreshedAt: string;
}

export function normalizeQuotation(q: Quotation): Quotation {
  const subtotal = typeof q.subtotal === 'number' ? q.subtotal : 0;
  const totalDiscount = typeof q.totalDiscount === 'number' ? q.totalDiscount : (q.totalDiscountAmount ?? 0);
  const tax = typeof q.tax === 'number' ? q.tax : 0;
  const taxableAmount = typeof q.taxableAmount === 'number' ? q.taxableAmount : Math.max(0, subtotal - totalDiscount);
  const grandTotal = typeof q.grandTotal === 'number' ? q.grandTotal : (q.totalAmount ?? Number((taxableAmount + tax).toFixed(2)));
  const revenue = typeof q.revenue === 'number' ? q.revenue : (q.netAmount ?? (subtotal - totalDiscount));
  const netAmount = typeof q.netAmount === 'number' ? q.netAmount : revenue;
  const totalAmount = typeof q.totalAmount === 'number' ? q.totalAmount : grandTotal;
  const totalDiscountAmount = typeof q.totalDiscountAmount === 'number' ? q.totalDiscountAmount : totalDiscount;
  const marginPercent = typeof q.marginPercent === 'number' ? q.marginPercent : (q.blendedMarginPercent ?? 0);
  const blendedMarginPercent = typeof q.blendedMarginPercent === 'number' ? q.blendedMarginPercent : marginPercent;
  const blendedRiskValue = q.blendedRiskValue || q.blendedRiskLevel || 'LOW';
  const blendedRiskLevel = q.blendedRiskLevel || blendedRiskValue;

  return {
    ...q,
    subtotal,
    totalDiscount,
    totalDiscountAmount,
    taxableAmount,
    tax,
    grandTotal,
    totalAmount,
    netAmount,
    revenue,
    marginPercent,
    blendedMarginPercent,
    blendedRiskValue,
    blendedRiskLevel,
    blendedRiskScore: typeof q.blendedRiskScore === 'number' ? q.blendedRiskScore : 0,
    requiredApprovers: q.requiredApprovers || [],
    currentApprovalStep: q.currentApprovalStep ?? 0,
    approvalRequired: q.approvalRequired ?? ((q.requiredApprovers && q.requiredApprovers.length > 0) || false),
  };
}

function createInitialState(): DealStoreState {
  return {
    currentUser: SEED_USERS[0], // Default: Sarah Chen (sales_rep)
    isAuthenticated: true,
    selectedTeam: 'Enterprise Accounts',
    users: [...SEED_USERS],
    customers: JSON.parse(JSON.stringify(SEED_CUSTOMERS)),
    products: JSON.parse(JSON.stringify(SEED_PRODUCTS)),
    warehouses: JSON.parse(JSON.stringify(SEED_WAREHOUSES)),
    discountTiers: JSON.parse(JSON.stringify(SEED_DISCOUNT_TIERS)),
    categoryCeilings: JSON.parse(JSON.stringify(SEED_CATEGORY_CEILINGS)),
    approvalRules: JSON.parse(JSON.stringify(SEED_APPROVAL_RULES)),
    quotations: JSON.parse(JSON.stringify(SEED_QUOTATIONS)).map(normalizeQuotation),
    approvalSteps: JSON.parse(JSON.stringify(SEED_APPROVAL_STEPS)),
    subscriptionPlans: JSON.parse(JSON.stringify(SEED_SUBSCRIPTION_PLANS)),
    subscriptions: JSON.parse(JSON.stringify(SEED_SUBSCRIPTIONS)),
    invoices: JSON.parse(JSON.stringify(SEED_INVOICES)),
    negotiations: JSON.parse(JSON.stringify(SEED_NEGOTIATION_REQUESTS)),
    dealHealthFlags: JSON.parse(JSON.stringify(SEED_DEAL_HEALTH_FLAGS)),
    upsellSuggestions: JSON.parse(JSON.stringify(SEED_UPSELL_SUGGESTIONS)),
    timelineEvents: JSON.parse(JSON.stringify(SEED_TIMELINE_EVENTS)),
    creditNotes: JSON.parse(JSON.stringify(SEED_CREDIT_NOTES)),
    prorationEvents: JSON.parse(JSON.stringify(SEED_PRORATION_EVENTS)),
    subscriptionBillingConfig: {
      prorationRule: 'daily_linear',
      cancellationRefundRule: 'prorated_credit',
      allowMidCycleUpgrade: true,
      creditNotePrefix: 'CN-2026',
    },
    priceLists: JSON.parse(JSON.stringify(SEED_PRICE_LISTS)),
    upsellRules: JSON.parse(JSON.stringify(SEED_UPSELL_RULES)),
    reportingConfig: JSON.parse(JSON.stringify(SEED_REPORTING_CONFIG)),
    configAuditTrail: JSON.parse(JSON.stringify(SEED_CONFIG_AUDIT_TRAIL)),
    dismissedUpsellIds: {},
    activeFulfillmentSplits: {
      'QT-2026-1042': {
        strategy: 'Single Warehouse Priority',
        totalShipments: 1,
        estimatedCost: 450,
        quotationId: 'QT-2026-1042',
        requiresSplit: false,
        isSplit: false,
        allocations: [
          {
            warehouseId: 'WH-MUMBAI',
            warehouseName: 'Mumbai Distribution Center',
            productId: 'PROD-IOT-GW4K',
            quantity: 6,
            quantityFulfilled: 6,
            estimatedShipments: 1,
            shippingCost: 450,
          },
        ],
        backorderedLines: [
          {
            productId: 'PROD-IOT-GW4K',
            productName: 'Industrial IoT Gateway 4000',
            requested: 10,
            fulfilled: 6,
            backordered: 4,
            quantity: 4,
          },
        ],
        totalCost: 13200,
        leadTimeDays: 3,
        fulfillmentStatus: 'Partially Shipped',
        notes: '6 units allocated and shipped from Mumbai hub. 4 units awaiting restock.',
      },
    },
    lastRefreshedAt: new Date().toISOString(),
  };
}

function loadPersistedState(): DealStoreState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure required collections exist
        const initial = createInitialState();
        let mergedQuotations: Quotation[] = Array.isArray(parsed.quotations)
          ? parsed.quotations.map(normalizeQuotation)
          : initial.quotations;

        // Ensure newly added seed records are merged into existing local storage
        const existingIds = new Set(mergedQuotations.map((q) => q.id));
        const existingCodes = new Set(mergedQuotations.map((q) => q.code));
        for (const seedQ of initial.quotations) {
          if (!existingIds.has(seedQ.id) && !existingCodes.has(seedQ.code)) {
            mergedQuotations.push(seedQ);
          }
        }

        const mergedCustomers = Array.isArray(parsed.customers) ? [...parsed.customers] : [...initial.customers];
        const existingCustIds = new Set(mergedCustomers.map((c: { id: string }) => c.id));
        for (const seedC of initial.customers) {
          if (!existingCustIds.has(seedC.id)) {
            mergedCustomers.push(seedC);
          }
        }

        const mergedUsers = Array.isArray(parsed.users) ? [...parsed.users] : [...initial.users];
        const existingUserIds = new Set(mergedUsers.map((u: { id: string }) => u.id));
        for (const seedU of initial.users) {
          if (!existingUserIds.has(seedU.id)) {
            mergedUsers.push(seedU);
          }
        }

        const mergedSteps = Array.isArray(parsed.approvalSteps) ? [...parsed.approvalSteps] : [...initial.approvalSteps];
        const existingStepIds = new Set(mergedSteps.map((s: { id: string }) => s.id));
        for (const seedS of initial.approvalSteps) {
          if (!existingStepIds.has(seedS.id)) {
            mergedSteps.push(seedS);
          }
        }

        const mergedSubscriptions = Array.isArray(parsed.subscriptions) ? [...parsed.subscriptions] : [...initial.subscriptions];
        const existingSubIds = new Set(mergedSubscriptions.map((s: { id: string }) => s.id));
        const existingSubCodes = new Set(mergedSubscriptions.map((s: { code: string }) => s.code));
        for (const seedSub of initial.subscriptions) {
          if (!existingSubIds.has(seedSub.id) && !existingSubCodes.has(seedSub.code)) {
            mergedSubscriptions.push(seedSub);
          }
        }

        const mergedCreditNotes = Array.isArray(parsed.creditNotes) ? [...parsed.creditNotes] : [...initial.creditNotes];
        const existingCnIds = new Set(mergedCreditNotes.map((c: { id: string }) => c.id));
        for (const seedCn of initial.creditNotes) {
          if (!existingCnIds.has(seedCn.id)) {
            mergedCreditNotes.push(seedCn);
          }
        }

        const mergedProrationEvents = Array.isArray(parsed.prorationEvents) ? [...parsed.prorationEvents] : [...initial.prorationEvents];
        const existingProrIds = new Set(mergedProrationEvents.map((p: { id: string }) => p.id));
        for (const seedPror of initial.prorationEvents) {
          if (!existingProrIds.has(seedPror.id)) {
            mergedProrationEvents.push(seedPror);
          }
        }

        const mergedInvoices = Array.isArray(parsed.invoices) ? [...parsed.invoices] : [...initial.invoices];
        const existingInvIds = new Set(mergedInvoices.map((i: { id: string }) => i.id));
        const existingInvCodes = new Set(mergedInvoices.map((i: { code: string }) => i.code));
        for (const seedInv of initial.invoices) {
          if (!existingInvIds.has(seedInv.id) && !existingInvCodes.has(seedInv.code)) {
            mergedInvoices.push(seedInv);
          }
        }

        const mergedPriceLists = Array.isArray(parsed.priceLists) && parsed.priceLists.length > 0
          ? parsed.priceLists
          : initial.priceLists;
        const mergedUpsellRules = Array.isArray(parsed.upsellRules) && parsed.upsellRules.length > 0
          ? parsed.upsellRules
          : initial.upsellRules;
        const mergedReportingConfig = parsed.reportingConfig
          ? { ...initial.reportingConfig, ...parsed.reportingConfig }
          : initial.reportingConfig;
        const mergedAuditTrail = Array.isArray(parsed.configAuditTrail) && parsed.configAuditTrail.length > 0
          ? parsed.configAuditTrail
          : initial.configAuditTrail;

        return {
          ...initial,
          ...parsed,
          users: mergedUsers,
          customers: mergedCustomers,
          quotations: mergedQuotations,
          approvalSteps: mergedSteps,
          subscriptions: mergedSubscriptions,
          creditNotes: mergedCreditNotes,
          prorationEvents: mergedProrationEvents,
          invoices: mergedInvoices,
          priceLists: mergedPriceLists,
          upsellRules: mergedUpsellRules,
          reportingConfig: mergedReportingConfig,
          configAuditTrail: mergedAuditTrail,
          subscriptionBillingConfig: parsed.subscriptionBillingConfig || initial.subscriptionBillingConfig,
          activeFulfillmentSplits: {
            ...initial.activeFulfillmentSplits,
            ...(parsed.activeFulfillmentSplits || {}),
          },
          lastRefreshedAt: new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.warn('DealStore: Failed to load state from localStorage, using initial baseline', e);
  }
  return createInitialState();
}

function persistState(state: DealStoreState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('DealStore: Failed to persist state to localStorage', e);
  }
}

class DealStore {
  private state: DealStoreState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = loadPersistedState();
  }

  public getState(): DealStoreState {
    return this.state;
  }

  public setState(updater: Partial<DealStoreState> | ((prevState: DealStoreState) => Partial<DealStoreState>)): void {
    const nextState = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = {
      ...this.state,
      ...nextState,
      lastRefreshedAt: new Date().toISOString(),
    };
    persistState(this.state);
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Reset Demo Baseline: Restores pristine seed state and clears persisted drift
   */
  public resetToSeed(): void {
    this.state = createInitialState();
    persistState(this.state);
    this.notify();
  }

  public resetDemoData(): void {
    this.resetToSeed();
  }

  public refreshData(): void {
    this.state = {
      ...this.state,
      lastRefreshedAt: new Date().toISOString(),
    };
    this.notify();
  }

  public switchRole(role: UserRole): void {
    const normalized = role.toLowerCase().replace('_', '');
    const matchedUser =
      this.state.users.find(
        (u) =>
          u.role.toLowerCase().replace('_', '') === normalized ||
          u.role === role
      ) || this.state.users[0];

    this.state = {
      ...this.state,
      currentUser: matchedUser,
    };
    persistState(this.state);
    this.notify();
  }

  public setCurrentUser(user: User): void {
    this.state = {
      ...this.state,
      currentUser: user,
      isAuthenticated: true,
    };
    persistState(this.state);
    this.notify();
  }

  public loginUser(user: User, team?: string): void {
    this.state = {
      ...this.state,
      currentUser: user,
      isAuthenticated: true,
      selectedTeam: team || this.state.selectedTeam || 'Enterprise Accounts',
    };
    persistState(this.state);
    this.notify();
  }

  public logoutUser(): void {
    this.state = {
      ...this.state,
      isAuthenticated: false,
    };
    persistState(this.state);
    this.notify();
  }

  // ==========================================
  // TIMELINE & AUDIT LOGGING
  // ==========================================

  public logTimelineEvent(
    quotationId: string,
    eventType: string,
    note: string,
    metadata?: Record<string, unknown>
  ): TimelineEvent {
    const actor = this.state.currentUser;
    const newEvent: TimelineEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      quotationId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      eventType,
      timestamp: new Date().toISOString(),
      note,
      metadata,
    };

    this.setState((prev) => ({
      timelineEvents: [newEvent, ...prev.timelineEvents],
    }));

    return newEvent;
  }

  // ==========================================
  // RECALCULATION PIPELINE
  // ==========================================

  /**
   * Core pipeline: Recalculates an entire quotation whenever lines, discounts,
   * or customer tier change. Synchronizes financials, risk, and approval routing.
   */
  public recalculateQuotation(quotation: Quotation): Quotation {
    const customer = this.state.customers.find((c) => c.id === quotation.customerId);
    const tier = quotation.customerTier || customer?.tier || 'Gold';

    // 1. Recalculate each line
    const recalculatedLines: QuotationLine[] = quotation.lines.map((line) => {
      const product = this.state.products.find((p) => p.id === line.productId);
      const cat = line.category || product?.category || 'Hardware';
      const basePrice = line.baseUnitPrice ?? product?.price ?? product?.basePrice ?? 100;
      const discount = line.discountPercent ?? 0;
      const qty = line.quantity ?? 1;

      // Effective ceiling
      const { effectiveLimit } = getEffectiveDiscountLimit(
        cat,
        tier,
        this.state.categoryCeilings,
        this.state.discountTiers
      );

      const { status, overBy } = computeLineStatus(discount, effectiveLimit);
      const margin = computeMarginDelta(product || { price: basePrice }, discount, qty);

      return {
        ...line,
        category: cat,
        baseUnitPrice: basePrice,
        unitPrice: Number((basePrice * (1 - discount / 100)).toFixed(2)),
        categoryLimitPercent: effectiveLimit,
        subtotal: basePrice * qty,
        discountAmount: margin.discountAmount,
        lineTotal: margin.revenue,
        overBy,
        overByPoints: overBy,
        lineStatus: status,
        revenue: margin.revenue,
        cost: margin.cost,
        profit: margin.profit,
        marginPercent: margin.marginPercent,
      };
    });

    // 2. Financial totals
    const totals = computeQuotationTotals(recalculatedLines);
    const orderDiscountPercent = Math.max(0, Math.min(100, quotation.orderDiscountPercent || 0));
    const orderDiscountAmount = orderDiscountPercent > 0
      ? Number(((totals.subtotal - totals.totalDiscount) * (orderDiscountPercent / 100)).toFixed(2))
      : 0;

    const combinedDiscount = Number((totals.totalDiscount + orderDiscountAmount).toFixed(2));
    const taxableAmount = Math.max(0, Number((totals.subtotal - combinedDiscount).toFixed(2)));
    const tax = Number((taxableAmount * 0.10).toFixed(2));
    const grandTotal = Number((taxableAmount + tax).toFixed(2));
    const revenue = Math.max(0, Number((totals.revenue - orderDiscountAmount).toFixed(2)));
    const profit = Number((revenue - totals.cost).toFixed(2));
    const marginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

    // 3. Blended Risk
    const risk = computeBlendedRiskScore(recalculatedLines);

    // 4. Required Approvers
    const requiredApprovers = computeRequiredApprovers(risk, this.state.approvalRules);

    return {
      ...quotation,
      lines: recalculatedLines,
      customerTier: tier,
      orderDiscountPercent,
      orderDiscountAmount,
      subtotal: totals.subtotal,
      totalDiscount: combinedDiscount,
      totalDiscountAmount: combinedDiscount,
      taxableAmount,
      tax,
      grandTotal,
      totalAmount: grandTotal,
      netAmount: revenue,
      revenue,
      cost: totals.cost,
      profit,
      marginPercent,
      blendedMarginPercent: marginPercent,
      blendedRiskScore: risk.score,
      blendedRiskValue: risk.level,
      blendedRiskLevel: risk.level,
      requiredApprovers,
      approvalRequired: requiredApprovers.length > 0,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
  }

  // ==========================================
  // QUOTATION ACTIONS
  // ==========================================

  public createQuotation(data: Partial<Quotation>): Quotation {
    const authCheck = canUserPerformAction(this.state.currentUser, 'create_quotation');
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Permission denied: cannot create quotation.');
    }

    const nextNumber = 1043 + this.state.quotations.length;
    const code = `Q-${nextNumber}`;
    const customer = this.state.customers.find((c) => c.id === data.customerId) || this.state.customers[0];

    const rawQuote: Quotation = {
      id: `QT-${code}`,
      code,
      customerId: customer.id,
      customerName: customer.name,
      customerTier: customer.tier,
      priceListTier: customer.tier,
      stage: 'Draft',
      assignedRepId: this.state.currentUser.id,
      repName: this.state.currentUser.name,
      viewCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      lines: data.lines || [],
      subtotal: 0,
      totalDiscount: 0,
      tax: 0,
      grandTotal: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      marginPercent: 40,
      blendedRiskScore: 10,
      blendedRiskValue: 'LOW',
      requiredApprovers: [],
      currentApprovalStep: 0,
      notes: data.notes || '',
    };

    const finalQuote = this.recalculateQuotation(rawQuote);

    this.setState((prev) => ({
      quotations: [finalQuote, ...prev.quotations],
    }));

    this.logTimelineEvent(
      finalQuote.id,
      'QUOTE_CREATED',
      `Quotation ${finalQuote.code} created for ${finalQuote.customerName} under ${finalQuote.customerTier} pricing.`
    );

    return finalQuote;
  }

  public updateQuotation(id: string, updates: Partial<Quotation>): Quotation {
    const existing = this.state.quotations.find((q) => q.id === id || q.code === id);
    if (!existing) {
      throw new Error(`Quotation not found: ${id}`);
    }

    const updatedMerged = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    const recalculated = this.recalculateQuotation(updatedMerged);

    this.setState((prev) => ({
      quotations: prev.quotations.map((q) => (q.id === recalculated.id ? recalculated : q)),
    }));

    return recalculated;
  }

  public addQuotationLine(
    quotationId: string,
    productId: string,
    quantity = 1,
    discountPercent = 0
  ): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const product = this.state.products.find((p) => p.id === productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const customer = this.state.customers.find((c) => c.id === quote.customerId);
    const tier = quote.customerTier || customer?.tier || 'Gold';
    let basePrice = product.price ?? product.basePrice;

    // Check if price list has custom price for this customer / tier
    const matchingPriceList = this.state.priceLists.find(
      (pl) => pl.active && (pl.id === customer?.priceListId || pl.tier === tier)
    );
    if (matchingPriceList) {
      const customItem = matchingPriceList.items.find((i) => i.productId === product.id);
      if (customItem && typeof customItem.customPrice === 'number') {
        basePrice = customItem.customPrice;
      }
    }

    const newLineId = `LINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newLine: QuotationLine = {
      id: newLineId,
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      baseUnitPrice: basePrice,
      unitPrice: basePrice,
      discountPercent,
      categoryLimitPercent: product.discountCeilingPercent || 15,
      subtotal: basePrice * quantity,
      discountAmount: 0,
      lineTotal: basePrice * quantity,
      overBy: 0,
      lineStatus: 'OK',
      revenue: basePrice * quantity,
      cost: basePrice * (product.costBasisPercent ? product.costBasisPercent / 100 : 0.6) * quantity,
      profit: basePrice * (1 - (product.costBasisPercent ? product.costBasisPercent / 100 : 0.6)) * quantity,
      marginPercent: 100 - (product.costBasisPercent || 60),
      isSubscription: product.isSubscription,
      recurringCycle: product.recurringCycle,
    };

    const updated = this.updateQuotation(quote.id, {
      lines: [...quote.lines, newLine],
    });

    this.logTimelineEvent(
      updated.id,
      'LINE_ADDED',
      `Added ${quantity}x ${product.name} at $${product.price ?? product.basePrice}/unit.`
    );

    return updated;
  }

  public removeQuotationLine(quotationId: string, lineId: string): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const lineToRemove = quote.lines.find((l) => l.id === lineId);
    const updated = this.updateQuotation(quote.id, {
      lines: quote.lines.filter((l) => l.id !== lineId),
    });

    if (lineToRemove) {
      this.logTimelineEvent(
        updated.id,
        'LINE_REMOVED',
        `Removed item ${lineToRemove.productName} from order lines.`
      );
    }

    return updated;
  }

  public updateLineQuantity(quotationId: string, lineId: string, quantity: number): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const updatedLines = quote.lines.map((l) =>
      l.id === lineId ? { ...l, quantity: Math.max(1, quantity) } : l
    );

    const updated = this.updateQuotation(quote.id, { lines: updatedLines });
    this.logTimelineEvent(
      updated.id,
      'LINE_UPDATED',
      `Adjusted order quantity to ${quantity} for line item.`
    );
    return updated;
  }

  public updateLineDiscount(quotationId: string, lineId: string, discountPercent: number): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const updatedLines = quote.lines.map((l) =>
      l.id === lineId ? { ...l, discountPercent: Math.max(0, Math.min(100, discountPercent)) } : l
    );

    const updated = this.updateQuotation(quote.id, { lines: updatedLines });
    const targetLine = updated.lines.find((l) => l.id === lineId);

    this.logTimelineEvent(
      updated.id,
      'DISCOUNT_CHANGED',
      `Discount adjusted to ${discountPercent}% on ${targetLine?.productName || 'line'}. Status: ${targetLine?.lineStatus} (Over by ${targetLine?.overBy} pts). Blended risk: ${updated.blendedRiskValue}.`,
      { lineId, discountPercent, overBy: targetLine?.overBy, risk: updated.blendedRiskValue }
    );

    return updated;
  }

  public updateOrderDiscount(quotationId: string, orderDiscountPercent: number): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const updated = this.updateQuotation(quote.id, {
      orderDiscountPercent: Math.max(0, Math.min(100, orderDiscountPercent)),
    });

    this.logTimelineEvent(
      updated.id,
      'ORDER_DISCOUNT_CHANGED',
      `Order-level discount set to ${orderDiscountPercent}%. Grand total updated to $${updated.grandTotal}.`
    );

    return updated;
  }

  // ==========================================
  // UPSELL ENGINE ACTIONS
  // ==========================================

  public addUpsellToQuotation(quotationId: string, productId: string): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const updated = this.addQuotationLine(quote.id, productId, 1, 0);

    this.logTimelineEvent(
      updated.id,
      'UPSELL_ADDED',
      `Accepted AI upsell recommendation: added product to quotation.`
    );

    return updated;
  }

  public dismissUpsell(quotationId: string, productId: string): void {
    this.setState((prev) => {
      const current = prev.dismissedUpsellIds[quotationId] || [];
      return {
        dismissedUpsellIds: {
          ...prev.dismissedUpsellIds,
          [quotationId]: [...current, productId],
        },
      };
    });
  }

  // ==========================================
  // APPROVAL STATE MACHINE
  // ==========================================

  public submitQuotationForApproval(quotationId: string, note = 'Submitted to deal desk'): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    if (quote.requiredApprovers.length === 0) {
      // Auto-approved!
      const approvedQuote = this.updateQuotation(quote.id, {
        stage: 'Approved',
        currentApprovalStep: 0,
        revisionNote: undefined,
      });

      this.logTimelineEvent(
        approvedQuote.id,
        'AUTO_APPROVED',
        'Quotation terms fully compliant with tier ceilings. Auto-approved without delay.'
      );

      return approvedQuote;
    }

    // Determine pass number: preserve previous passes for auditable revision history
    const existingSteps = this.state.approvalSteps.filter((s) => s.quotationId === quote.id);
    const existingMaxPass = existingSteps.reduce((max, s) => Math.max(max, s.pass || 1), 0);
    const isResubmission = existingSteps.length > 0 || quote.stage === 'Returned for Revision' || quote.stage === 'ReturnedForRevision';
    const nextPass = isResubmission ? existingMaxPass + 1 : 1;

    // High or Medium: generate approval steps for this pass
    const newSteps: ApprovalStep[] = quote.requiredApprovers.map((role, idx) => ({
      id: `STEP-${quote.id}-P${nextPass}-${idx + 1}-${Date.now()}`,
      quotationId: quote.id,
      stepOrder: idx + 1,
      approverRole: role,
      status: idx === 0 ? 'Pending' : 'Waiting',
      user: role === 'finance' ? 'Elena Rostova' : 'David Vance',
      actorName: role === 'finance' ? 'Elena Rostova' : 'David Vance',
      note: idx === 0 ? note : 'Awaiting completion of preliminary step',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString(),
      pass: nextPass,
    }));

    const updated = this.updateQuotation(quote.id, {
      stage: 'Pending Approval',
      currentApprovalStep: 1,
      assignedApproverRole: quote.requiredApprovers[0],
      revisionNote: undefined,
    });

    this.setState((prev) => ({
      approvalSteps: [
        ...prev.approvalSteps,
        ...newSteps,
      ],
    }));

    if (isResubmission) {
      this.logTimelineEvent(
        updated.id,
        'RESUBMITTED',
        `Quotation revised and resubmitted for governance review (Pass ${nextPass}). Assigned to ${quote.requiredApprovers[0] === 'finance' ? 'Finance' : 'Sales Manager'}. Note: "${note}".`
      );
    } else {
      this.logTimelineEvent(
        updated.id,
        'APPROVAL_STARTED',
        `Submitted for governance review. Chain: ${quote.requiredApprovers.join(' → ')}. Blended risk: ${updated.blendedRiskValue}. Note: "${note}".`
      );
    }

    return updated;
  }

  public approveQuotation(quotationId: string, note = 'Approved by deal desk'): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const authCheck = canUserPerformAction(this.state.currentUser, 'approve_quotation', { quotation: quote });
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Permission denied: cannot approve quotation.');
    }

    const currentStepIndex = quote.currentApprovalStep;
    const totalSteps = quote.requiredApprovers.length;

    // Find the current active pass for this quotation
    const quoteSteps = this.state.approvalSteps.filter((s) => s.quotationId === quote.id);
    const activePass = quoteSteps.reduce((max, s) => Math.max(max, s.pass || 1), 1);

    // Mark current step approved and, if intermediate, activate next step from 'Waiting' to 'Pending'
    const updatedSteps = this.state.approvalSteps.map((s) => {
      if (s.quotationId === quote.id && (s.pass || 1) === activePass && s.stepOrder === currentStepIndex) {
        return {
          ...s,
          status: 'Approved' as const,
          action: 'Approved' as const,
          date: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          actorId: this.state.currentUser.id,
          actorName: this.state.currentUser.name,
          user: this.state.currentUser.name,
          note: note || 'Approved by deal desk',
        };
      }
      if (
        currentStepIndex < totalSteps &&
        s.quotationId === quote.id &&
        (s.pass || 1) === activePass &&
        s.stepOrder === currentStepIndex + 1 &&
        (s.status === 'Waiting' || s.status === 'Pending')
      ) {
        return {
          ...s,
          status: 'Pending' as const,
          timestamp: new Date().toISOString(),
        };
      }
      return s;
    });

    if (currentStepIndex >= totalSteps) {
      // Final approval completed!
      const fullyApproved = this.updateQuotation(quote.id, {
        stage: 'Approved',
        assignedApproverRole: undefined,
      });

      this.setState({ approvalSteps: updatedSteps });

      this.logTimelineEvent(
        fullyApproved.id,
        'APPROVED',
        `Quotation fully approved by ${this.state.currentUser.name} (${this.state.currentUser.role}). Note: "${note}". Ready for order confirmation.`
      );

      return fullyApproved;
    }

    // Advance to next step (e.g. Sales Manager -> Finance)
    const nextStepIndex = currentStepIndex + 1;
    const nextRole = quote.requiredApprovers[nextStepIndex - 1];

    const advancedQuote = this.updateQuotation(quote.id, {
      currentApprovalStep: nextStepIndex,
      assignedApproverRole: nextRole,
    });

    this.setState({ approvalSteps: updatedSteps });

    this.logTimelineEvent(
      advancedQuote.id,
      'APPROVED',
      `Step ${currentStepIndex} signed off by ${this.state.currentUser.name} (${this.state.currentUser.role}). Note: "${note}". Advanced to Step ${nextStepIndex} (${nextRole === 'finance' ? 'Finance' : 'Sales Manager'}).`
    );

    return advancedQuote;
  }

  public returnQuotation(quotationId: string, note: string): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const authCheck = canUserPerformAction(this.state.currentUser, 'return_quotation', { quotation: quote });
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Permission denied.');
    }

    const currentStepIndex = quote.currentApprovalStep;
    const quoteSteps = this.state.approvalSteps.filter((s) => s.quotationId === quote.id);
    const activePass = quoteSteps.reduce((max, s) => Math.max(max, s.pass || 1), 1);

    const returnedQuote = this.updateQuotation(quote.id, {
      stage: 'Returned for Revision',
      currentApprovalStep: 0,
      assignedApproverRole: undefined,
      revisionNote: note,
    });

    this.setState((prev) => ({
      approvalSteps: prev.approvalSteps.map((s) =>
        s.quotationId === quote.id && (s.pass || 1) === activePass && s.stepOrder === currentStepIndex
          ? {
              ...s,
              status: 'Returned',
              action: 'ReturnedForRevision',
              date: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              actorId: this.state.currentUser.id,
              actorName: this.state.currentUser.name,
              user: this.state.currentUser.name,
              note,
            }
          : s
      ),
    }));

    this.logTimelineEvent(
      returnedQuote.id,
      'RETURNED_FOR_REVISION',
      `Quotation returned for revision by ${this.state.currentUser.name} (${this.state.currentUser.role}). Reviewer feedback: "${note}".`
    );

    return returnedQuote;
  }

  public rejectQuotation(quotationId: string, note: string): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const authCheck = canUserPerformAction(this.state.currentUser, 'reject_quotation', { quotation: quote });
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Permission denied.');
    }

    const currentStepIndex = quote.currentApprovalStep;
    const quoteSteps = this.state.approvalSteps.filter((s) => s.quotationId === quote.id);
    const activePass = quoteSteps.reduce((max, s) => Math.max(max, s.pass || 1), 1);

    const rejectedQuote = this.updateQuotation(quote.id, {
      stage: 'Rejected',
      assignedApproverRole: undefined,
    });

    this.setState((prev) => ({
      approvalSteps: prev.approvalSteps.map((s) =>
        s.quotationId === quote.id && (s.pass || 1) === activePass && s.stepOrder === currentStepIndex
          ? {
              ...s,
              status: 'Rejected',
              action: 'Rejected',
              date: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              actorId: this.state.currentUser.id,
              actorName: this.state.currentUser.name,
              user: this.state.currentUser.name,
              note,
            }
          : s
      ),
    }));

    this.logTimelineEvent(
      rejectedQuote.id,
      'REJECTED',
      `Quotation rejected by ${this.state.currentUser.name} (${this.state.currentUser.role}). Reason: "${note}".`
    );

    return rejectedQuote;
  }

  // ==========================================
  // CUSTOMER NEGOTIATION & RE-APPROVAL
  // ==========================================

  public createNegotiationRequest(
    quotationId: string,
    request: Partial<NegotiationRequest>
  ): NegotiationRequest {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const newReq: NegotiationRequest = {
      id: `NEG-${Date.now()}`,
      quotationId: quote.id,
      customerId: quote.customerId,
      customerName: quote.customerName,
      lineId: request.lineId,
      type: request.type || 'discount_counter',
      requestedDiscount: request.requestedDiscount || 15,
      counterDiscountPercent: request.requestedDiscount || 15,
      message: request.message || request.comment || 'Requesting discount adjustment',
      comment: request.message || request.comment || 'Requesting discount adjustment',
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    this.updateQuotation(quote.id, {
      stage: 'Negotiation',
      negotiationStatus: 'Pending',
    });

    this.setState((prev) => ({
      negotiations: [newReq, ...prev.negotiations],
    }));

    this.logTimelineEvent(
      quote.id,
      'CUSTOMER_CHANGE_REQUESTED',
      `Customer submitted counter-proposal: ${newReq.message} (Requested: ${newReq.requestedDiscount}% discount).`
    );

    return newReq;
  }

  /**
   * Evaluates and applies a customer-submitted counter offer from the Customer Portal.
   * Atomically executes either:
   * PATH A: Within governance limits -> Stage stays Approved/Ready for Confirmation, no approval pass created.
   * PATH B: Exceeds governance limits -> Automatically triggers re-approval, generates new approval pass, updates stage to Pending Approval.
   */
  public submitCustomerNegotiation(params: {
    quotationId: string;
    counterDiscount: number;
    requestedDeliveryDate: string;
    message: string;
    lineId?: string;
    customerActor?: { id: string; name: string };
  }): {
    success: boolean;
    path: 'within_limits' | 'approval_required';
    quotation: Quotation;
    request: NegotiationRequest;
  } {
    const { quotationId, counterDiscount, requestedDeliveryDate, message, lineId, customerActor } = params;
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const authorName = customerActor?.name || quote.customerName || 'Customer';

    // Apply the counter-discount to the specified line or across applicable lines
    const targetLineId = lineId || (quote.lines.length > 0 ? quote.lines[0].id : undefined);
    const updatedLines = quote.lines.map((line) => {
      if (!lineId || line.id === targetLineId) {
        return {
          ...line,
          discountPercent: Math.max(0, Math.min(100, counterDiscount)),
          previousDiscountPercent: line.discountPercent,
        };
      }
      return line;
    });

    // Run the SAME canonical governance engine!
    const reevaluatedQuote = this.recalculateQuotation({
      ...quote,
      lines: updatedLines,
      requestedDeliveryDate: requestedDeliveryDate || quote.requestedDeliveryDate,
      revisionNote: message,
    });

    const isOverLimits = reevaluatedQuote.requiredApprovers.length > 0;

    const newReq: NegotiationRequest = {
      id: `NEG-${Date.now()}`,
      quotationId: quote.id,
      customerId: quote.customerId,
      customerName: authorName,
      authorName,
      authorRole: 'Customer',
      lineId: targetLineId,
      type: lineId ? 'line_change' : 'discount_counter',
      requestedDiscount: counterDiscount,
      counterDiscountPercent: counterDiscount,
      requestedDeliveryDate,
      message,
      comment: message,
      status: isOverLimits ? 'UnderReview' : 'Accepted',
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };

    // Update negotiations state
    this.setState((prev) => ({
      negotiations: [newReq, ...prev.negotiations],
    }));

    if (isOverLimits) {
      // PATH B — EXCEEDS GOVERNANCE LIMITS:
      // Quotation automatically re-enters approval flow!
      const quoteWithReviewState = this.updateQuotation(reevaluatedQuote.id, {
        ...reevaluatedQuote,
        stage: 'Pending Approval',
        negotiationStatus: 'UnderReview',
        requestedDeliveryDate,
        revisionNote: message,
      });

      // Submit for re-approval pass (preserves previous passes, routes chain from top)
      const reapproved = this.submitQuotationForApproval(
        quoteWithReviewState.id,
        `Customer counter-offer: ${counterDiscount}% discount requested by ${authorName}. Reason: ${message}`
      );

      this.logTimelineEvent(
        reapproved.id,
        'CUSTOMER_COUNTER_OFFER',
        `Customer ${authorName} submitted counter-offer: ${counterDiscount}% discount and delivery by ${requestedDeliveryDate}. Terms exceed limits — automatically routed for re-approval.`,
        { counterDiscount, requestedDeliveryDate, requiredApprovers: reapproved.requiredApprovers }
      );

      return {
        success: true,
        path: 'approval_required',
        quotation: reapproved,
        request: newReq,
      };
    } else {
      // PATH A — WITHIN GOVERNANCE LIMITS:
      // No unnecessary approval pass is created!
      const acceptedQuote = this.updateQuotation(reevaluatedQuote.id, {
        ...reevaluatedQuote,
        stage: 'Approved',
        negotiationStatus: 'Accepted',
        requestedDeliveryDate,
        revisionNote: undefined,
      });

      this.logTimelineEvent(
        acceptedQuote.id,
        'CUSTOMER_COUNTER_OFFER',
        `Customer ${authorName} submitted counter-offer: ${counterDiscount}% discount and delivery by ${requestedDeliveryDate}. Terms are within limits — accepted.`,
        { counterDiscount, requestedDeliveryDate }
      );

      return {
        success: true,
        path: 'within_limits',
        quotation: acceptedQuote,
        request: newReq,
      };
    }
  }

  /**
   * Adds a line-level or proposal-level question/comment to the negotiation thread
   */
  public addNegotiationMessage(params: {
    quotationId: string;
    lineId?: string;
    message: string;
    authorName: string;
    authorRole?: string;
  }): NegotiationRequest {
    const { quotationId, lineId, message, authorName, authorRole = 'Customer' } = params;
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const targetLine = quote.lines.find((l) => l.id === lineId);

    const newReq: NegotiationRequest = {
      id: `NEG-MSG-${Date.now()}`,
      quotationId: quote.id,
      customerId: quote.customerId,
      customerName: quote.customerName,
      authorName,
      authorRole,
      lineId,
      type: lineId ? 'line_change' : 'question',
      message,
      comment: message,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };

    this.setState((prev) => ({
      negotiations: [newReq, ...prev.negotiations],
    }));

    this.logTimelineEvent(
      quote.id,
      'CUSTOMER_QUESTION',
      `${authorName} posted a question${targetLine ? ` on ${targetLine.productName}` : ''}: "${message}"`,
      { lineId, authorName }
    );

    return newReq;
  }

  /**
   * Confirms quotation from the customer portal, validating eligibility and advancing to Confirmed.
   */
  public confirmQuotation(
    quotationId: string,
    customerActor?: { id: string; name: string }
  ): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    if (
      quote.stage === 'Pending Approval' ||
      quote.stage === 'PendingApproval' ||
      quote.negotiationStatus === 'UnderReview'
    ) {
      throw new Error("This quotation can't be confirmed while your requested changes are under review.");
    }

    const actorName = customerActor?.name || this.state.currentUser.name || quote.customerName || 'Customer';
    const actorId = customerActor?.id || this.state.currentUser.id || 'USR-CUST';

    const confirmed = this.updateQuotation(quote.id, {
      stage: 'Confirmed',
      negotiationStatus: 'Accepted',
      lastActivityAt: new Date().toISOString(),
    });

    this.logTimelineEvent(
      confirmed.id,
      'QUOTATION_CONFIRMED',
      `Quotation digitally confirmed by ${actorName}. Commercial terms locked; order is moving to fulfillment preparation.`,
      { actorId, actorName, stage: 'Confirmed' }
    );

    return confirmed;
  }

  /**
   * Applies negotiation changes and automatically triggers re-approval if threshold exceeded!
   */
  public applyNegotiationChange(
    quotationId: string,
    negotiationId: string,
    action: 'accept' | 'counter' | 'reject',
    counterDiscount?: number
  ): Quotation {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const neg = this.state.negotiations.find((n) => n.id === negotiationId);

    if (action === 'reject') {
      this.setState((prev) => ({
        negotiations: prev.negotiations.map((n) =>
          n.id === negotiationId ? { ...n, status: 'Rejected', respondedAt: new Date().toISOString() } : n
        ),
      }));

      const reverted = this.updateQuotation(quote.id, {
        stage: 'Approved',
        negotiationStatus: 'Rejected',
      });

      this.logTimelineEvent(
        reverted.id,
        'COUNTER_OFFERED',
        `Negotiation counter-offer declined by rep. Reverted to previous approved terms.`
      );

      return reverted;
    }

    // Apply the agreed discount
    const agreedDiscount =
      action === 'accept'
        ? neg?.requestedDiscount ?? 15
        : counterDiscount ?? 12;

    const targetLineId = neg?.lineId || quote.lines[0]?.id;
    const updatedLines = quote.lines.map((l) =>
      l.id === targetLineId ? { ...l, discountPercent: agreedDiscount } : l
    );

    // Recalculate quotation with new terms
    const reevaluatedQuote = this.recalculateQuotation({
      ...quote,
      lines: updatedLines,
    });

    // Update negotiation record
    this.setState((prev) => ({
      negotiations: prev.negotiations.map((n) =>
        n.id === negotiationId ? { ...n, status: 'Accepted', respondedAt: new Date().toISOString() } : n
      ),
    }));

    // RE-APPROVAL CHECK:
    // If the newly negotiated terms require approval (e.g. risk is HIGH or MEDIUM),
    // quotation MUST re-enter approval stage!
    if (reevaluatedQuote.requiredApprovers.length > 0) {
      const reapproved = this.submitQuotationForApproval(
        reevaluatedQuote.id,
        `Negotiation re-approval: customer agreed to ${agreedDiscount}% discount, triggering governance threshold.`
      );

      this.logTimelineEvent(
        reapproved.id,
        'REAPPROVAL_TRIGGERED',
        `Customer negotiation terms (${agreedDiscount}% discount) exceed allowed limits. Re-approval required by ${reapproved.requiredApprovers.join(' → ')}.`
      );

      return reapproved;
    }

    // If within limits, advance to Confirmed
    const confirmedQuote = this.updateQuotation(reevaluatedQuote.id, {
      stage: 'Confirmed',
      negotiationStatus: 'Accepted',
    });

    this.logTimelineEvent(
      confirmedQuote.id,
      'COUNTER_OFFERED',
      `Negotiation resolved. New terms are fully compliant. Quotation Confirmed.`
    );

    return confirmedQuote;
  }

  // ==========================================
  // FULFILLMENT & INVENTORY
  // ==========================================

  public createFulfillment(quotationId: string): WarehouseSplitResult {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const splitResult = computeWarehouseSplit(quote.lines, this.state.warehouses);

    this.setState((prev) => ({
      activeFulfillmentSplits: {
        ...prev.activeFulfillmentSplits,
        [quote.id]: splitResult,
      },
    }));

    this.logTimelineEvent(
      quote.id,
      'FULFILLMENT_CREATED',
      `Fulfillment split generated: ${splitResult.allocations.length} allocations via ${splitResult.strategy}.`
    );

    return splitResult;
  }

  public acceptWarehouseSplit(quotationId: string, splitResult: WarehouseSplitResult): void {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    // If an allocation was previously accepted for this quotation, first release its reservations
    const prevSplit = this.state.activeFulfillmentSplits[quote.id];
    let workingWarehouses = JSON.parse(JSON.stringify(this.state.warehouses)) as Warehouse[];
    if (prevSplit && prevSplit.allocations.length > 0) {
      for (const prevAlloc of prevSplit.allocations) {
        const wh = workingWarehouses.find((w) => w.id === prevAlloc.warehouseId);
        if (wh) {
          const stk = wh.stock.find((s) => s.productId === prevAlloc.productId);
          if (stk) {
            stk.reserved = Math.max(0, stk.reserved - prevAlloc.quantityFulfilled);
          }
        }
      }
    }

    // Deduct available stock (reserve it in warehouses for new split)
    for (const alloc of splitResult.allocations) {
      const wh = workingWarehouses.find((w) => w.id === alloc.warehouseId);
      if (wh) {
        const stk = wh.stock.find((s) => s.productId === alloc.productId);
        if (stk) {
          stk.reserved += alloc.quantityFulfilled;
        }
      }
    }

    this.updateQuotation(quote.id, {
      stage: 'Fulfillment',
    });

    this.setState((prev) => ({
      warehouses: workingWarehouses,
      activeFulfillmentSplits: {
        ...prev.activeFulfillmentSplits,
        [quote.id]: splitResult,
      },
    }));

    this.logTimelineEvent(
      quote.id,
      'WAREHOUSE_SPLIT_ACCEPTED',
      `Multi-facility split accepted: reserved inventory across ${splitResult.allocations.length} warehouse locations.`
    );
  }

  public overrideWarehouseSplit(
    quotationId: string,
    allocations: WarehouseSplitAllocation[]
  ): void {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    // Release any previous reservation for this quotation before validating against live capacity
    const prevSplit = this.state.activeFulfillmentSplits[quote.id];
    let workingWarehouses = JSON.parse(JSON.stringify(this.state.warehouses)) as Warehouse[];
    if (prevSplit && prevSplit.allocations.length > 0) {
      for (const prevAlloc of prevSplit.allocations) {
        const wh = workingWarehouses.find((w) => w.id === prevAlloc.warehouseId);
        if (wh) {
          const stk = wh.stock.find((s) => s.productId === prevAlloc.productId);
          if (stk) {
            stk.reserved = Math.max(0, stk.reserved - prevAlloc.quantityFulfilled);
          }
        }
      }
    }

    const mapped = allocations.map((a) => ({
      warehouseId: a.warehouseId,
      productId: a.productId,
      quantity: a.quantityFulfilled ?? 0,
    }));
    const validation = validateWarehouseOverride(mapped, workingWarehouses);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid warehouse allocation override.');
    }

    // Apply new reservations
    for (const alloc of allocations) {
      if (alloc.quantityFulfilled > 0) {
        const wh = workingWarehouses.find((w) => w.id === alloc.warehouseId);
        if (wh) {
          const stk = wh.stock.find((s) => s.productId === alloc.productId);
          if (stk) {
            stk.reserved += alloc.quantityFulfilled;
          }
        }
      }
    }

    // Recompute costs and shipment counts
    const activeAllocations = allocations.filter((a) => a.quantityFulfilled > 0);
    const uniqueWarehouses = new Set(activeAllocations.map((a) => a.warehouseId));
    const totalShipping = activeAllocations.reduce((sum, a) => sum + (a.shippingCost || 0), 0);
    const totalHandling = activeAllocations.reduce((sum, a) => sum + (a.handlingCost || 0), 0);
    const totalFulfillmentCost = Number((totalShipping + totalHandling).toFixed(2));

    const updatedSplit: WarehouseSplitResult = {
      strategy: 'Manual Logistics Override',
      allocations: activeAllocations,
      totalShipments: uniqueWarehouses.size,
      estimatedCost: totalFulfillmentCost,
      explanation: `Manual override applied: fulfillment distributed across ${uniqueWarehouses.size} facilities (${Array.from(uniqueWarehouses).join(', ')}).`,
      costBreakdown: {
        shippingCost: totalShipping,
        handlingCost: totalHandling,
        totalFulfillmentCost,
      },
      backorderedLines: prevSplit?.backorderedLines || [],
    };

    this.updateQuotation(quote.id, {
      stage: 'Fulfillment',
    });

    this.setState((prev) => ({
      warehouses: workingWarehouses,
      activeFulfillmentSplits: {
        ...prev.activeFulfillmentSplits,
        [quote.id]: updatedSplit,
      },
    }));

    this.logTimelineEvent(
      quote.id,
      'WAREHOUSE_OVERRIDE',
      `Logistics override applied by ${this.state.currentUser.name}: ${activeAllocations.length} allocations recomputed.`
    );
  }

  public consolidateBackorderAction(
    quotationId: string,
    productId: string,
    arrivedQuantity: number,
    targetWarehouseId: string
  ): void {
    const quote = this.state.quotations.find((q) => q.id === quotationId || q.code === quotationId);
    if (!quote) throw new Error(`Quotation not found: ${quotationId}`);

    const currentSplit = this.state.activeFulfillmentSplits[quote.id] || computeWarehouseSplit(quote.lines, this.state.warehouses);

    const result = consolidateBackorder(
      productId,
      arrivedQuantity,
      targetWarehouseId,
      this.state.warehouses,
      currentSplit.backorderedLines
    );

    const targetWh = this.state.warehouses.find((w) => w.id === targetWarehouseId);
    const existingAllocIndex = currentSplit.allocations.findIndex(
      (a) => a.warehouseId === targetWarehouseId && a.productId === productId
    );

    const updatedAllocations = [...currentSplit.allocations];
    if (existingAllocIndex >= 0) {
      const existing = updatedAllocations[existingAllocIndex];
      const newQty = existing.quantityFulfilled + result.allocatedQuantity;
      const handling = Number((newQty * 3.5).toFixed(2));
      updatedAllocations[existingAllocIndex] = {
        ...existing,
        quantityFulfilled: newQty,
        handlingCost: handling,
        totalCost: Number((existing.shippingCost + handling).toFixed(2)),
      };
    } else {
      const baseFreight = Number((120 * (targetWh?.shippingCostWeight || 1.0)).toFixed(2));
      const handling = Number((result.allocatedQuantity * 3.5).toFixed(2));
      updatedAllocations.push({
        warehouseId: targetWarehouseId,
        warehouseName: targetWh?.name || 'Warehouse',
        productId,
        quantityFulfilled: result.allocatedQuantity,
        estimatedShipments: 1,
        shippingCost: baseFreight,
        handlingCost: handling,
        totalCost: Number((baseFreight + handling).toFixed(2)),
      });
    }

    const uniqueWarehouses = new Set(updatedAllocations.map((a) => a.warehouseId));
    const totalShipping = updatedAllocations.reduce((sum, a) => sum + (a.shippingCost || 0), 0);
    const totalHandling = updatedAllocations.reduce((sum, a) => sum + (a.handlingCost || 0), 0);
    const totalCost = Number((totalShipping + totalHandling).toFixed(2));

    const updatedSplit: WarehouseSplitResult = {
      ...currentSplit,
      allocations: updatedAllocations,
      totalShipments: uniqueWarehouses.size,
      estimatedCost: totalCost,
      costBreakdown: {
        shippingCost: totalShipping,
        handlingCost: totalHandling,
        totalFulfillmentCost: totalCost,
      },
      backorderedLines: result.remainingBackorders,
    };

    this.setState((prev) => ({
      warehouses: result.updatedWarehouses,
      activeFulfillmentSplits: {
        ...prev.activeFulfillmentSplits,
        [quote.id]: updatedSplit,
      },
    }));

    this.logTimelineEvent(
      quote.id,
      'BACKORDER_CONSOLIDATED',
      result.message
    );
  }

  public restockWarehouse(warehouseId: string, productId: string, quantity: number): void {
    const updatedWarehouses = this.state.warehouses.map((w) => {
      if (w.id === warehouseId) {
        const stock = w.stock.map((s) => {
          if (s.productId === productId) {
            return {
              ...s,
              inStock: s.inStock + quantity,
            };
          }
          return s;
        });
        return { ...w, stock };
      }
      return w;
    });

    this.setState({ warehouses: updatedWarehouses });
  }

  // ==========================================
  // INVOICES & PAYMENTS
  // ==========================================

  public createInvoice(invoiceData: Partial<Invoice>): Invoice {
    const nextNumber = 2026001 + this.state.invoices.length;
    const code = `INV-2026-${String(nextNumber).slice(-3)}`;

    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      code,
      quotationId: invoiceData.quotationId || '',
      customerId: invoiceData.customerId || '',
      customerName: invoiceData.customerName || 'Customer',
      amount: invoiceData.amount || 1000,
      status: 'Unpaid',
      dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      deliveryStage: 'Invoiced',
      isRecurring: invoiceData.isRecurring ?? false,
      issueDate: new Date().toISOString().split('T')[0],
      lines: invoiceData.lines || [],
    };

    this.setState((prev) => ({
      invoices: [newInvoice, ...prev.invoices],
    }));

    this.logTimelineEvent(
      newInvoice.quotationId,
      'INVOICE_CREATED',
      `Invoice ${newInvoice.code} generated for $${(newInvoice.amount ?? 0).toLocaleString()}. Due: ${newInvoice.dueDate}.`
    );

    return newInvoice;
  }

  public getInvoice(id: string): Invoice | undefined {
    return this.state.invoices.find((i) => i.id === id || i.code === id);
  }

  public recordPayment(
    invoiceId: string,
    paymentDetails?: {
      amount?: number;
      paymentDate?: string;
      paymentMethod?: string;
      reference?: string;
      note?: string;
      recordedBy?: string;
    }
  ): Invoice {
    const invoice = this.state.invoices.find((i) => i.id === invoiceId || i.code === invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    const currentUser = this.state.currentUser;
    const actorName = paymentDetails?.recordedBy || currentUser?.name || 'Finance Admin';
    const actorRole = currentUser?.role || 'finance';

    // Derive real balance due
    const currentPaid = invoice.paidAmount ?? (invoice.status === 'Paid' ? invoice.amount : 0);
    const outstandingBalance = invoice.balanceDue !== undefined ? invoice.balanceDue : Math.max(0, invoice.amount - currentPaid);
    const paymentAmount = paymentDetails?.amount !== undefined ? paymentDetails.amount : outstandingBalance;

    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }
    if (paymentAmount > outstandingBalance && outstandingBalance > 0) {
      throw new Error(
        `Payment amount ($${paymentAmount.toLocaleString()}) cannot exceed outstanding balance ($${outstandingBalance.toLocaleString()}).`
      );
    }

    const newPaidAmount = Number((currentPaid + paymentAmount).toFixed(2));
    const newBalanceDue = Number(Math.max(0, invoice.amount - newPaidAmount).toFixed(2));
    const isFullyPaid = newBalanceDue <= 0;
    const newStatus: InvoiceStatus = isFullyPaid ? 'Paid' : 'Partially Paid';
    const newDeliveryStage: DeliveryStage = isFullyPaid ? 'Paid' : invoice.deliveryStage;

    const paymentRecord: PaymentRecord = {
      id: `PAY-${Date.now()}`,
      invoiceId: invoice.id,
      amount: paymentAmount,
      paymentDate: paymentDetails?.paymentDate || new Date().toISOString().split('T')[0],
      paymentMethod: paymentDetails?.paymentMethod || 'Bank Transfer',
      reference: paymentDetails?.reference || `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      note: paymentDetails?.note || '',
      recordedBy: actorName,
      recordedAt: new Date().toISOString(),
    };

    const auditEntry: InvoiceAuditEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: isFullyPaid ? 'Invoice Paid in Full' : 'Partial Payment Recorded',
      actor: actorName,
      role: actorRole,
      note: `Recorded ${paymentRecord.paymentMethod} payment of $${paymentAmount.toLocaleString()} (Ref: ${paymentRecord.reference}). Outstanding balance: $${newBalanceDue.toLocaleString()}.`,
    };

    const existingPayments = invoice.payments || [];
    const existingAudit = invoice.auditTrail || [];

    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
      deliveryStage: newDeliveryStage,
      paidAt: isFullyPaid ? new Date().toISOString() : invoice.paidAt,
      payments: [paymentRecord, ...existingPayments],
      auditTrail: [auditEntry, ...existingAudit],
    };

    this.setState((prev) => ({
      invoices: prev.invoices.map((i) => (i.id === updatedInvoice.id ? updatedInvoice : i)),
    }));

    if (updatedInvoice.quotationId) {
      this.logTimelineEvent(
        updatedInvoice.quotationId,
        'PAYMENT_RECORDED',
        `Payment of $${paymentAmount.toLocaleString()} recorded for Invoice ${updatedInvoice.code} (${updatedInvoice.status}). Balance due: $${newBalanceDue.toLocaleString()}.`
      );
    }

    return updatedInvoice;
  }

  // ==========================================
  // SUBSCRIPTIONS & PRORATION
  // ==========================================

  public createSubscription(data: Partial<Subscription>): Subscription {
    const nextCode = `SUB-2026-${String(this.state.subscriptions.length + 1).padStart(3, '0')}`;
    const newSub: Subscription = {
      id: `SUB-${Date.now()}`,
      code: nextCode,
      customerId: data.customerId || '',
      customerName: data.customerName || 'Customer',
      quotationId: data.quotationId || '',
      planId: data.planId || 'PLAN-CARE2',
      planName: data.planName || 'Care Plan 2yr Monthly',
      cycle: data.cycle || 'monthly',
      status: 'Active',
      quantity: data.quantity || 1,
      startDate: new Date().toISOString().split('T')[0],
      nextBillDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      unitRecurringPrice: data.unitRecurringPrice || 40,
      amount: (data.quantity || 1) * (data.unitRecurringPrice || 40),
    };

    this.setState((prev) => ({
      subscriptions: [newSub, ...prev.subscriptions],
    }));

    this.logTimelineEvent(
      newSub.quotationId,
      'SUBSCRIPTION_CREATED',
      `Active recurring subscription ${newSub.code} initialized ($${newSub.amount}/month).`
    );

    return newSub;
  }

  public modifySubscription(
    subscriptionId: string,
    updates: Partial<Subscription> & {
      effectiveDate?: string;
      prorationRule?: 'daily_linear' | 'full_month';
      reason?: string;
    }
  ): { subscription: Subscription; prorationEvent?: ProrationEvent } {
    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId || s.code === subscriptionId);
    if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`);

    const targetPlan = updates.planId
      ? this.state.subscriptionPlans.find((p) => p.id === updates.planId)
      : this.state.subscriptionPlans.find((p) => p.id === sub.planId);

    const newPlanName = targetPlan ? targetPlan.name : (updates.planName || sub.planName);
    const newUnitRecurringPrice = targetPlan ? targetPlan.price : (updates.unitRecurringPrice ?? sub.unitRecurringPrice);
    const newQuantity = updates.quantity ?? sub.quantity;
    const newAmount = newQuantity * newUnitRecurringPrice;

    // Proration calculation
    let prorationEvent: ProrationEvent | undefined;
    const rule = updates.prorationRule || this.state.subscriptionBillingConfig.prorationRule || 'daily_linear';

    const effectiveDate = updates.effectiveDate || new Date().toISOString().split('T')[0];
    const periodStart = sub.startDate || new Date().toISOString().split('T')[0];
    const periodEnd = sub.nextBillDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const previousAmount = sub.amount ?? ((sub.quantity || 1) * (sub.unitRecurringPrice || 0));

    const proration = calculateProration({
      previousPlanName: sub.planName,
      previousQuantity: sub.quantity,
      previousRecurringAmount: previousAmount,
      newPlanName,
      newQuantity,
      newRecurringAmount: newAmount,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      effectiveDate,
      rule,
      cycle: sub.cycle || 'monthly',
    });

    if (previousAmount !== newAmount || updates.planId !== sub.planId || updates.quantity !== sub.quantity) {
      prorationEvent = {
        id: `PROR-${Date.now()}`,
        subscriptionId: sub.id,
        quotationId: sub.quotationId,
        effectiveDate,
        periodStart,
        periodEnd,
        previousPlanName: sub.planName || 'Current Plan',
        previousQuantity: sub.quantity,
        previousAmount,
        newPlanName: newPlanName || 'Updated Plan',
        newQuantity,
        newAmount,
        totalDaysInPeriod: proration.totalDaysInPeriod || 30,
        remainingDays: proration.remainingDays,
        creditAmount: proration.creditAmount,
        proratedCharge: proration.proratedCharge,
        netAdjustment: proration.netAdjustment,
        createdAt: new Date().toISOString(),
        ruleApplied: proration.ruleApplied,
        description: updates.reason || proration.description,
      };
    }

    const updatedSub: Subscription = {
      ...sub,
      ...updates,
      planName: newPlanName,
      unitRecurringPrice: newUnitRecurringPrice,
      quantity: newQuantity,
      amount: newAmount,
      lastProratedAt: prorationEvent ? new Date().toISOString() : sub.lastProratedAt,
    };

    this.setState((prev) => ({
      subscriptions: prev.subscriptions.map((s) => (s.id === updatedSub.id ? updatedSub : s)),
      prorationEvents: prorationEvent ? [prorationEvent, ...prev.prorationEvents] : prev.prorationEvents,
    }));

    this.logTimelineEvent(
      updatedSub.quotationId,
      'SUBSCRIPTION_MODIFIED',
      `Subscription terms updated to ${updatedSub.planName} (${updatedSub.quantity}x @ $${updatedSub.unitRecurringPrice}/mo). ${
        prorationEvent ? `Net adjustment: $${prorationEvent.netAdjustment.toFixed(2)}.` : ''
      }`
    );

    return { subscription: updatedSub, prorationEvent };
  }

  public cancelSubscription(
    subscriptionId: string,
    options?: {
      reason?: string;
      effectiveDate?: string;
      refundPolicy?: 'prorated_credit' | 'full_credit' | 'no_refund';
      usedDays?: number;
      totalDays?: number;
    }
  ): { subscription: Subscription; creditAdjustment: ReturnType<typeof calculateCancellationRefund>; creditNote?: CreditNote } {
    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId || s.code === subscriptionId);
    if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`);

    const policy = options?.refundPolicy || this.state.subscriptionBillingConfig.cancellationRefundRule || 'prorated_credit';
    const effectiveDate = options?.effectiveDate || new Date().toISOString().split('T')[0];
    const periodStart = sub.startDate || new Date().toISOString().split('T')[0];
    const periodEnd = sub.nextBillDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const subAmount = sub.amount ?? ((sub.quantity || 1) * (sub.unitRecurringPrice || 0));

    const refund = calculateCancellationRefund({
      recurringAmount: subAmount,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      cancellationDate: effectiveDate,
      policy,
      usedDays: options?.usedDays,
      totalDays: options?.totalDays,
    });

    let creditNote: CreditNote | undefined;
    if (refund.creditAmount > 0) {
      const nextCnCode = `CN-2026-${String(this.state.creditNotes.length + 1).padStart(4, '0')}`;
      creditNote = {
        id: `CN-${Date.now()}`,
        code: nextCnCode,
        subscriptionId: sub.id,
        subscriptionCode: sub.code,
        quotationId: sub.quotationId,
        quotationCode: sub.quotationCode || sub.quotationId,
        customerId: sub.customerId,
        customerName: sub.customerName,
        amount: refund.creditAmount,
        status: 'Draft',
        reason: options?.reason || `Unused days credit upon subscription cancellation (${refund.policyApplied})`,
        createdAt: new Date().toISOString(),
        effectiveDate,
      };
    }

    const cancelledSub: Subscription = {
      ...sub,
      status: 'Cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: options?.reason || refund.description,
    };

    this.setState((prev) => ({
      subscriptions: prev.subscriptions.map((s) => (s.id === cancelledSub.id ? cancelledSub : s)),
      creditNotes: creditNote ? [creditNote, ...prev.creditNotes] : prev.creditNotes,
    }));

    this.logTimelineEvent(
      cancelledSub.quotationId,
      'SUBSCRIPTION_CANCELLED',
      `Subscription ${sub.code} cancelled. ${refund.description}${creditNote ? ` Generated Credit Note ${creditNote.code} for $${creditNote.amount.toFixed(2)}.` : ''}`
    );

    return { subscription: cancelledSub, creditAdjustment: refund, creditNote };
  }

  public createCreditNote(data: Partial<CreditNote>): CreditNote {
    const nextCode = `CN-2026-${String(this.state.creditNotes.length + 1).padStart(4, '0')}`;
    const newCN: CreditNote = {
      id: `CN-${Date.now()}`,
      code: nextCode,
      subscriptionId: data.subscriptionId,
      subscriptionCode: data.subscriptionCode,
      quotationId: data.quotationId || '',
      quotationCode: data.quotationCode || '',
      customerId: data.customerId || '',
      customerName: data.customerName || 'Customer',
      amount: data.amount || 0,
      status: data.status || 'Draft',
      reason: data.reason || 'Manual credit note adjustment',
      createdAt: new Date().toISOString(),
      effectiveDate: data.effectiveDate || new Date().toISOString().split('T')[0],
    };

    this.setState((prev) => ({
      creditNotes: [newCN, ...prev.creditNotes],
    }));

    return newCN;
  }

  public updateCreditNoteStatus(creditNoteId: string, status: CreditNote['status']): CreditNote {
    const cn = this.state.creditNotes.find((c) => c.id === creditNoteId || c.code === creditNoteId);
    if (!cn) throw new Error(`Credit Note not found: ${creditNoteId}`);

    const updatedCN: CreditNote = { ...cn, status };

    this.setState((prev) => ({
      creditNotes: prev.creditNotes.map((c) => (c.id === updatedCN.id ? updatedCN : c)),
    }));

    return updatedCN;
  }

  public updateSubscriptionBillingConfig(updates: Partial<SubscriptionBillingConfig>): SubscriptionBillingConfig {
    const updatedConfig: SubscriptionBillingConfig = {
      ...this.state.subscriptionBillingConfig,
      ...updates,
    };

    this.setState({
      subscriptionBillingConfig: updatedConfig,
    });

    return updatedConfig;
  }

  // ==========================================
  // BACKEND CONFIGURATION ENGINE & AUDIT
  // ==========================================

  public logConfigAudit(entry: {
    category: ConfigAuditEvent['category'];
    recordName: string;
    recordId?: string;
    action: ConfigAuditEvent['action'];
    oldValue?: string;
    newValue?: string;
    details?: string;
  }): ConfigAuditEvent {
    const newEvent: ConfigAuditEvent = {
      id: `AUD-CFG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      category: entry.category,
      recordName: entry.recordName,
      recordId: entry.recordId,
      action: entry.action,
      actorName: this.state.currentUser?.name || 'Administrator',
      actorRole: this.state.currentUser?.role || 'admin',
      timestamp: new Date().toISOString(),
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      details: entry.details,
    };

    this.setState((prev) => ({
      configAuditTrail: [newEvent, ...prev.configAuditTrail],
    }));

    return newEvent;
  }

  public saveProduct(product: Product): Product {
    const isNew = !this.state.products.some((p) => p.id === product.id);
    const normalizedProduct: Product = {
      ...product,
      basePrice: product.price ?? product.basePrice,
      price: product.price ?? product.basePrice,
    };

    let updatedProducts: Product[];
    if (isNew) {
      updatedProducts = [normalizedProduct, ...this.state.products];
    } else {
      updatedProducts = this.state.products.map((p) => (p.id === product.id ? normalizedProduct : p));
    }

    this.logConfigAudit({
      category: 'products',
      recordName: normalizedProduct.name,
      recordId: normalizedProduct.id,
      action: isNew ? 'create' : 'update',
      newValue: `$${normalizedProduct.price} (${normalizedProduct.category})`,
      details: isNew ? 'Created new product catalog item' : 'Updated product catalog specifications',
    });

    this.setState({ products: updatedProducts });
    return normalizedProduct;
  }

  public archiveProduct(productId: string): Product {
    const prod = this.state.products.find((p) => p.id === productId);
    if (!prod) throw new Error(`Product not found: ${productId}`);

    const updated: Product = { ...prod, status: 'Archived' };
    this.logConfigAudit({
      category: 'products',
      recordName: prod.name,
      recordId: prod.id,
      action: 'archive',
      oldValue: 'Active',
      newValue: 'Archived',
      details: 'Product archived from active catalog.',
    });

    this.setState((prev) => ({
      products: prev.products.map((p) => (p.id === productId ? updated : p)),
    }));

    return updated;
  }

  public savePriceList(priceList: PriceList): PriceList {
    const isNew = !this.state.priceLists.some((pl) => pl.id === priceList.id);
    let updatedPriceLists: PriceList[];
    if (isNew) {
      updatedPriceLists = [...this.state.priceLists, priceList];
    } else {
      updatedPriceLists = this.state.priceLists.map((pl) => (pl.id === priceList.id ? priceList : pl));
    }

    this.logConfigAudit({
      category: 'price_lists',
      recordName: priceList.name,
      recordId: priceList.id,
      action: isNew ? 'create' : 'update',
      newValue: `Tier: ${priceList.tier} (${priceList.items.length} items)`,
      details: `${isNew ? 'Created' : 'Updated'} custom volume price schedule.`,
    });

    this.setState({ priceLists: updatedPriceLists });
    return priceList;
  }

  public saveCategoryCeiling(category: ProductCategory, maxDiscountPercent: number): CategoryDiscountRule {
    const existing = this.state.categoryCeilings.find((c) => c.category === category);
    const oldVal = existing ? `${existing.maxDiscountPercent}%` : '-';
    const updatedRule: CategoryDiscountRule = { category, maxDiscountPercent };
    const updatedCeilings = existing
      ? this.state.categoryCeilings.map((c) => (c.category === category ? updatedRule : c))
      : [...this.state.categoryCeilings, updatedRule];

    this.state = {
      ...this.state,
      categoryCeilings: updatedCeilings,
    };

    // Recalculate active draft quotes with new ceiling live
    const updatedQuotations = this.state.quotations.map((q) => {
      if (
        q.stage === 'Draft' ||
        q.stage === 'Returned for Revision' ||
        q.stage === 'ReturnedForRevision'
      ) {
        return this.recalculateQuotation(q);
      }
      return q;
    });

    this.logConfigAudit({
      category: 'discount_tiers',
      recordName: `${category} Category Ceiling`,
      recordId: category,
      action: 'update',
      oldValue: oldVal,
      newValue: `${maxDiscountPercent}%`,
      details: `Ceiling for ${category} updated to ${maxDiscountPercent}%. Active draft quotes recalculated.`,
    });

    this.setState({
      categoryCeilings: updatedCeilings,
      quotations: updatedQuotations,
    });

    return updatedRule;
  }

  public saveDiscountTier(tier: CustomerTier, maxDiscountPercent: number): DiscountTierRule {
    const existing = this.state.discountTiers.find((d) => d.tier === tier);
    const oldVal = existing ? `${existing.maxDiscountPercent}%` : '-';
    const updatedRule: DiscountTierRule = { tier, maxDiscountPercent };
    const updatedTiers = existing
      ? this.state.discountTiers.map((d) => (d.tier === tier ? updatedRule : d))
      : [...this.state.discountTiers, updatedRule];

    this.state = {
      ...this.state,
      discountTiers: updatedTiers,
    };

    const updatedQuotations = this.state.quotations.map((q) => {
      if (
        q.stage === 'Draft' ||
        q.stage === 'Returned for Revision' ||
        q.stage === 'ReturnedForRevision'
      ) {
        return this.recalculateQuotation(q);
      }
      return q;
    });

    this.logConfigAudit({
      category: 'discount_tiers',
      recordName: `${tier} Tier Limit`,
      recordId: tier,
      action: 'update',
      oldValue: oldVal,
      newValue: `${maxDiscountPercent}%`,
      details: `Tier limit for ${tier} updated to ${maxDiscountPercent}%. Active draft quotes recalculated.`,
    });

    this.setState({
      discountTiers: updatedTiers,
      quotations: updatedQuotations,
    });

    return updatedRule;
  }

  public saveApprovalRule(rule: ApprovalChainRule): ApprovalChainRule {
    const ruleId = rule.id || `CHAIN-${Date.now()}`;
    const normalizedRule: ApprovalChainRule = {
      ...rule,
      id: ruleId,
      active: rule.active !== false,
      priority: rule.priority || 1,
    };

    const existingIndex = this.state.approvalRules.findIndex(
      (r) => r.id === ruleId || r.discountRange === rule.discountRange
    );
    const oldRule = existingIndex >= 0 ? this.state.approvalRules[existingIndex] : undefined;

    let updatedRules: ApprovalChainRule[];
    if (existingIndex >= 0) {
      updatedRules = this.state.approvalRules.map((r, i) => (i === existingIndex ? normalizedRule : r));
    } else {
      updatedRules = [...this.state.approvalRules, normalizedRule];
    }

    this.state = {
      ...this.state,
      approvalRules: updatedRules,
    };

    // Recalculate draft quotations so required approvers reflect the new chain
    const updatedQuotations = this.state.quotations.map((q) => {
      if (
        q.stage === 'Draft' ||
        q.stage === 'Returned for Revision' ||
        q.stage === 'ReturnedForRevision'
      ) {
        return this.recalculateQuotation(q);
      }
      return q;
    });

    this.logConfigAudit({
      category: 'approval_chains',
      recordName: normalizedRule.name || normalizedRule.discountRange,
      recordId: ruleId,
      action: oldRule ? 'update' : 'create',
      oldValue: oldRule ? oldRule.requiredApprovers.join(', ') || 'None' : '-',
      newValue: normalizedRule.requiredApprovers.join(', ') || 'None',
      details: `Approval chain rule updated. Approvers: [${normalizedRule.requiredApprovers.join(', ')}].`,
    });

    this.setState({
      approvalRules: updatedRules,
      quotations: updatedQuotations,
    });

    return normalizedRule;
  }

  public saveWarehouse(warehouse: Warehouse): Warehouse {
    const isNew = !this.state.warehouses.some((w) => w.id === warehouse.id);
    let updatedWarehouses: Warehouse[];
    if (isNew) {
      updatedWarehouses = [...this.state.warehouses, warehouse];
    } else {
      updatedWarehouses = this.state.warehouses.map((w) => (w.id === warehouse.id ? warehouse : w));
    }

    this.logConfigAudit({
      category: 'warehouses',
      recordName: warehouse.name,
      recordId: warehouse.id,
      action: isNew ? 'create' : 'update',
      newValue: `${warehouse.city}, Cost Weight: ${warehouse.shippingCostWeight}`,
      details: `${isNew ? 'Created' : 'Updated'} warehouse operational facility.`,
    });

    this.setState({ warehouses: updatedWarehouses });
    return warehouse;
  }

  public toggleWarehouseActive(warehouseId: string, active: boolean): Warehouse {
    const wh = this.state.warehouses.find((w) => w.id === warehouseId);
    if (!wh) throw new Error(`Warehouse not found: ${warehouseId}`);

    const updated: Warehouse = { ...wh, active };
    this.logConfigAudit({
      category: 'warehouses',
      recordName: wh.name,
      recordId: wh.id,
      action: active ? 'activate' : 'deactivate',
      oldValue: `Active: ${wh.active}`,
      newValue: `Active: ${active}`,
      details: `Warehouse operational status changed to ${active ? 'Active' : 'Disabled'}.`,
    });

    this.setState((prev) => ({
      warehouses: prev.warehouses.map((w) => (w.id === warehouseId ? updated : w)),
    }));

    return updated;
  }

  public saveSubscriptionPlan(plan: SubscriptionPlan): SubscriptionPlan {
    const isNew = !this.state.subscriptionPlans.some((p) => p.id === plan.id);
    let updatedPlans: SubscriptionPlan[];
    if (isNew) {
      updatedPlans = [...this.state.subscriptionPlans, plan];
    } else {
      updatedPlans = this.state.subscriptionPlans.map((p) => (p.id === plan.id ? plan : p));
    }

    this.logConfigAudit({
      category: 'subscription_plans',
      recordName: plan.name,
      recordId: plan.id,
      action: isNew ? 'create' : 'update',
      newValue: `$${plan.price}/${plan.cycle}`,
      details: `${isNew ? 'Created' : 'Updated'} recurring subscription plan definition.`,
    });

    this.setState({ subscriptionPlans: updatedPlans });
    return plan;
  }

  public saveUpsellRule(rule: UpsellRule): UpsellRule {
    const isNew = !this.state.upsellRules.some((r) => r.id === rule.id);
    let updatedRules: UpsellRule[];
    if (isNew) {
      updatedRules = [...this.state.upsellRules, rule];
    } else {
      updatedRules = this.state.upsellRules.map((r) => (r.id === rule.id ? rule : r));
    }

    this.logConfigAudit({
      category: 'upsell_rules',
      recordName: rule.name,
      recordId: rule.id,
      action: isNew ? 'create' : 'update',
      newValue: `Trigger: ${rule.triggerProductName || rule.triggerProductId} -> ${rule.recommendedProductName || rule.recommendedProductId}`,
      details: `${isNew ? 'Created' : 'Updated'} recommendation pairing rule.`,
    });

    this.setState({ upsellRules: updatedRules });
    return rule;
  }

  public toggleUpsellRuleActive(ruleId: string, active: boolean): UpsellRule {
    const rule = this.state.upsellRules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Upsell rule not found: ${ruleId}`);

    const updated: UpsellRule = { ...rule, active };
    this.logConfigAudit({
      category: 'upsell_rules',
      recordName: rule.name,
      recordId: rule.id,
      action: active ? 'activate' : 'deactivate',
      oldValue: `Active: ${rule.active}`,
      newValue: `Active: ${active}`,
      details: `Recommendation pairing rule ${active ? 'Enabled' : 'Disabled'}.`,
    });

    this.setState((prev) => ({
      upsellRules: prev.upsellRules.map((r) => (r.id === ruleId ? updated : r)),
    }));

    return updated;
  }

  public saveReportingConfig(updates: Partial<ReportingConfiguration>): ReportingConfiguration {
    const updatedConfig: ReportingConfiguration = {
      ...this.state.reportingConfig,
      ...updates,
    };

    this.logConfigAudit({
      category: 'reporting',
      recordName: 'Reporting Preferences',
      action: 'update',
      newValue: `Default: ${updatedConfig.defaultPeriod}`,
      details: 'Updated operational reporting KPI visibility and company metadata.',
    });

    this.setState({ reportingConfig: updatedConfig });
    return updatedConfig;
  }
}

export const dealStore = new DealStore();
