/**
 * DealFlow360 — Master Store Reactive Hook
 */

import { useState, useEffect } from 'react';
import { dealStore, DealStoreState } from '../store/dealStore';

export function useDealStore(): DealStoreState & {
  resetToSeed: () => void;
  refreshData: () => void;
  createQuotation: typeof dealStore.createQuotation;
  updateQuotation: typeof dealStore.updateQuotation;
  addQuotationLine: typeof dealStore.addQuotationLine;
  removeQuotationLine: typeof dealStore.removeQuotationLine;
  updateLineQuantity: typeof dealStore.updateLineQuantity;
  updateLineDiscount: typeof dealStore.updateLineDiscount;
  updateOrderDiscount: typeof dealStore.updateOrderDiscount;
  addUpsellToQuotation: typeof dealStore.addUpsellToQuotation;
  dismissUpsell: typeof dealStore.dismissUpsell;
  submitQuotationForApproval: typeof dealStore.submitQuotationForApproval;
  approveQuotation: typeof dealStore.approveQuotation;
  returnQuotation: typeof dealStore.returnQuotation;
  rejectQuotation: typeof dealStore.rejectQuotation;
  logTimelineEvent: typeof dealStore.logTimelineEvent;
  recalculateQuotation: typeof dealStore.recalculateQuotation;
  createFulfillment: typeof dealStore.createFulfillment;
  acceptWarehouseSplit: typeof dealStore.acceptWarehouseSplit;
  overrideWarehouseSplit: typeof dealStore.overrideWarehouseSplit;
  consolidateBackorderAction: typeof dealStore.consolidateBackorderAction;
  restockWarehouse: typeof dealStore.restockWarehouse;
  createSubscription: typeof dealStore.createSubscription;
  modifySubscription: typeof dealStore.modifySubscription;
  cancelSubscription: typeof dealStore.cancelSubscription;
  createCreditNote: typeof dealStore.createCreditNote;
  updateCreditNoteStatus: typeof dealStore.updateCreditNoteStatus;
  updateSubscriptionBillingConfig: typeof dealStore.updateSubscriptionBillingConfig;
  createInvoice: typeof dealStore.createInvoice;
  recordPayment: typeof dealStore.recordPayment;
  createNegotiationRequest: typeof dealStore.createNegotiationRequest;
  submitCustomerNegotiation: typeof dealStore.submitCustomerNegotiation;
  addNegotiationMessage: typeof dealStore.addNegotiationMessage;
  confirmQuotation: typeof dealStore.confirmQuotation;
  applyNegotiationChange: typeof dealStore.applyNegotiationChange;
  saveProduct: typeof dealStore.saveProduct;
  archiveProduct: typeof dealStore.archiveProduct;
  savePriceList: typeof dealStore.savePriceList;
  saveCategoryCeiling: typeof dealStore.saveCategoryCeiling;
  saveDiscountTier: typeof dealStore.saveDiscountTier;
  saveApprovalRule: typeof dealStore.saveApprovalRule;
  saveWarehouse: typeof dealStore.saveWarehouse;
  toggleWarehouseActive: typeof dealStore.toggleWarehouseActive;
  saveSubscriptionPlan: typeof dealStore.saveSubscriptionPlan;
  saveUpsellRule: typeof dealStore.saveUpsellRule;
  toggleUpsellRuleActive: typeof dealStore.toggleUpsellRuleActive;
  saveReportingConfig: typeof dealStore.saveReportingConfig;
  logConfigAudit: typeof dealStore.logConfigAudit;
} {
  const [state, setState] = useState<DealStoreState>(dealStore.getState());

  useEffect(() => {
    const unsubscribe = dealStore.subscribe(() => {
      setState(dealStore.getState());
    });
    return unsubscribe;
  }, []);

  return {
    ...state,
    resetToSeed: () => dealStore.resetToSeed(),
    refreshData: () => dealStore.refreshData(),
    createQuotation: (data) => dealStore.createQuotation(data),
    updateQuotation: (id, updates) => dealStore.updateQuotation(id, updates),
    addQuotationLine: (qid, pid, qty, disc) => dealStore.addQuotationLine(qid, pid, qty, disc),
    removeQuotationLine: (qid, lid) => dealStore.removeQuotationLine(qid, lid),
    updateLineQuantity: (qid, lid, qty) => dealStore.updateLineQuantity(qid, lid, qty),
    updateLineDiscount: (qid, lid, disc) => dealStore.updateLineDiscount(qid, lid, disc),
    updateOrderDiscount: (qid, disc) => dealStore.updateOrderDiscount(qid, disc),
    addUpsellToQuotation: (qid, pid) => dealStore.addUpsellToQuotation(qid, pid),
    dismissUpsell: (qid, pid) => dealStore.dismissUpsell(qid, pid),
    submitQuotationForApproval: (qid, note) => dealStore.submitQuotationForApproval(qid, note),
    approveQuotation: (qid, note) => dealStore.approveQuotation(qid, note),
    returnQuotation: (qid, note) => dealStore.returnQuotation(qid, note),
    rejectQuotation: (qid, note) => dealStore.rejectQuotation(qid, note),
    logTimelineEvent: (qid, type, note, meta) => dealStore.logTimelineEvent(qid, type, note, meta),
    recalculateQuotation: (q) => dealStore.recalculateQuotation(q),
    createFulfillment: (qid) => dealStore.createFulfillment(qid),
    acceptWarehouseSplit: (qid, split) => dealStore.acceptWarehouseSplit(qid, split),
    overrideWarehouseSplit: (qid, allocs) => dealStore.overrideWarehouseSplit(qid, allocs),
    consolidateBackorderAction: (qid, pid, qty, wid) => dealStore.consolidateBackorderAction(qid, pid, qty, wid),
    restockWarehouse: (wid, pid, qty) => dealStore.restockWarehouse(wid, pid, qty),
    createSubscription: (data) => dealStore.createSubscription(data),
    modifySubscription: (id, updates) => dealStore.modifySubscription(id, updates),
    cancelSubscription: (id, opts) => dealStore.cancelSubscription(id, opts),
    createCreditNote: (data) => dealStore.createCreditNote(data),
    updateCreditNoteStatus: (id, status) => dealStore.updateCreditNoteStatus(id, status),
    updateSubscriptionBillingConfig: (updates) => dealStore.updateSubscriptionBillingConfig(updates),
    createInvoice: (data) => dealStore.createInvoice(data),
    recordPayment: (iid) => dealStore.recordPayment(iid),
    createNegotiationRequest: (qid, req) => dealStore.createNegotiationRequest(qid, req),
    submitCustomerNegotiation: (params) => dealStore.submitCustomerNegotiation(params),
    addNegotiationMessage: (params) => dealStore.addNegotiationMessage(params),
    confirmQuotation: (qid, actor) => dealStore.confirmQuotation(qid, actor),
    applyNegotiationChange: (qid, nid, act, disc) => dealStore.applyNegotiationChange(qid, nid, act, disc),
    saveProduct: (product) => dealStore.saveProduct(product),
    archiveProduct: (pid) => dealStore.archiveProduct(pid),
    savePriceList: (pl) => dealStore.savePriceList(pl),
    saveCategoryCeiling: (cat, max) => dealStore.saveCategoryCeiling(cat, max),
    saveDiscountTier: (tier, max) => dealStore.saveDiscountTier(tier, max),
    saveApprovalRule: (rule) => dealStore.saveApprovalRule(rule),
    saveWarehouse: (wh) => dealStore.saveWarehouse(wh),
    toggleWarehouseActive: (wid, act) => dealStore.toggleWarehouseActive(wid, act),
    saveSubscriptionPlan: (plan) => dealStore.saveSubscriptionPlan(plan),
    saveUpsellRule: (rule) => dealStore.saveUpsellRule(rule),
    toggleUpsellRuleActive: (rid, act) => dealStore.toggleUpsellRuleActive(rid, act),
    saveReportingConfig: (cfg) => dealStore.saveReportingConfig(cfg),
    logConfigAudit: (entry) => dealStore.logConfigAudit(entry),
  };
}
