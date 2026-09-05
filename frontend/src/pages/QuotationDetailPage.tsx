import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  TrendingUp,
  X,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  RotateCcw,
  UserCheck,
  Layers,
  HelpCircle,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Repeat,
} from 'lucide-react';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { Quotation, QuotationLine, Product, CustomerTier, RiskLevel, QuotationStage } from '../types';
import { formatCurrency, formatRelativeTime, formatExactDateTime } from '../utils/formatters';
import { MarginIndicator } from '../components/domain/MarginIndicator';
import { DiscountLimitRow } from '../components/domain/DiscountLimitRow';
import { getUpsellSuggestions } from '../domain/recommendations';
import { getEffectiveDiscountLimit, computeLineStatus } from '../domain/discounts';
import { RiskBadge, StatusBadge, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { aiService } from '../services/ai/aiService';
import { AIInsightPanel } from '../components/ai/AIInsightPanel';
import { AIDraftEditorModal } from '../components/ai/AIDraftEditorModal';
import { AIResult, AIAction } from '../services/ai/types';

export const QuotationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    quotations,
    customers,
    products,
    dismissedUpsellIds,
    timelineEvents,
    approvalSteps,
    updateQuotation,
    addQuotationLine,
    removeQuotationLine,
    updateLineQuantity,
    updateLineDiscount,
    updateOrderDiscount,
    addUpsellToQuotation,
    dismissUpsell,
    submitQuotationForApproval,
    createQuotation,
    logTimelineEvent,
    recalculateQuotation,
  } = useDealStore();

  const isNew = id === 'new';

  // Find quotation in store if not new
  const existingQuote = useMemo(() => {
    if (isNew) return null;
    return quotations.find((q) => q.id === id || q.code === id) || null;
  }, [id, isNew, quotations]);

  // Working state for new quotation before first store creation
  const [newQuoteDraft, setNewQuoteDraft] = useState<Quotation | null>(() => {
    if (!isNew) return null;
    const defaultCustomer = customers[0] || {
      id: 'CUST-008',
      name: 'Meridian Industrial Systems',
      tier: 'Gold',
    };
    const nextNum = 1043 + quotations.length;
    const code = `QT-2026-${nextNum}`;

    return {
      id: `QT-${code}`,
      code,
      customerId: defaultCustomer.id,
      customerName: defaultCustomer.name,
      customerTier: defaultCustomer.tier as CustomerTier,
      priceListTier: defaultCustomer.tier as CustomerTier,
      stage: 'Draft',
      assignedRepId: user?.id || 'USR-REP-01',
      repName: user?.name || 'Sarah Chen',
      viewCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      lines: [],
      subtotal: 0,
      totalDiscount: 0,
      tax: 0,
      grandTotal: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      marginPercent: 40,
      blendedRiskScore: 0,
      blendedRiskValue: 'LOW',
      requiredApprovers: [],
      currentApprovalStep: 0,
      notes: '',
      orderDiscountPercent: 0,
      expirationDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      requestedDeliveryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    };
  });

  // The active quote being rendered
  const activeQuote = isNew ? newQuoteDraft : existingQuote;

  // Active Tab at bottom
  const [activeTab, setActiveTab] = useState<'lines' | 'governance' | 'notes' | 'audit'>('lines');

  // Product selector modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // "Why this quote is risky" modal
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);

  // Notification / toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check stage editability
  const isEditable = useMemo(() => {
    if (!activeQuote) return false;
    return (
      activeQuote.stage === 'Draft' ||
      activeQuote.stage === 'Returned for Revision' ||
      activeQuote.stage === 'ReturnedForRevision'
    );
  }, [activeQuote]);

  // Check if quote has revision notes
  const isReturnedForRevision =
    activeQuote?.stage === 'Returned for Revision' || activeQuote?.stage === 'ReturnedForRevision';

  // Get Upsell suggestions for the active quotation
  const suggestions = useMemo(() => {
    if (!activeQuote) return [];
    const dismissed = dismissedUpsellIds[activeQuote.id] || [];
    return getUpsellSuggestions(activeQuote, products, dismissed);
  }, [activeQuote, products, dismissedUpsellIds]);

  // Filtered timeline events for this quotation
  const quoteEvents = useMemo(() => {
    if (!activeQuote) return [];
    return timelineEvents.filter((e) => e.quotationId === activeQuote.id || e.quotationId === activeQuote.code);
  }, [activeQuote, timelineEvents]);

  // Approval steps for this quotation
  const quoteApprovalSteps = useMemo(() => {
    if (!activeQuote) return [];
    return approvalSteps.filter((s) => s.quotationId === activeQuote.id || s.quotationId === activeQuote.code);
  }, [activeQuote, approvalSteps]);

  // AI Deal Copilot State (Section 13, 14, 15, 61, 62)
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState<string>('Analyzing deal...');
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [aiActiveAction, setAiActiveAction] = useState<string | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState<boolean>(false);
  const [draftModalContent, setDraftModalContent] = useState<{ subject: string; body: string; recipient: string }>({
    subject: '',
    body: '',
    recipient: '',
  });

  const getQuotationAiContext = () => {
    if (!activeQuote) return null;
    return {
      quotation: activeQuote,
      customerTier: activeQuote.customerTier,
      customerName: activeQuote.customerName,
      lines: activeQuote.lines,
      blendedRiskLevel: activeQuote.blendedRiskValue || activeQuote.blendedRiskLevel || 'LOW',
      blendedRiskScore: activeQuote.blendedRiskScore,
      approvalRequired: activeQuote.approvalRequired,
      requiredApprovers: activeQuote.requiredApprovers,
      marginPercent: activeQuote.marginPercent || 40,
      profit: activeQuote.profit || 0,
      grandTotal: activeQuote.grandTotal || 0,
      upsellOpportunities: suggestions.map((s) => s.productName),
      userRole: user.role,
    };
  };

  const handleAiSummarize = async () => {
    const ctx = getQuotationAiContext();
    if (!ctx) return;
    setIsAiLoading(true);
    setAiLoadingMessage('Analyzing quotation structure & commercial value...');
    setAiErrorMessage(null);
    setAiActiveAction('summary');
    try {
      const res = await aiService.summarizeQuotation(ctx);
      setAiResult(res);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to summarize quotation.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiExplainRisk = async () => {
    const ctx = getQuotationAiContext();
    if (!ctx) return;
    setIsAiLoading(true);
    setAiLoadingMessage('Evaluating discount exceptions & margin floors...');
    setAiErrorMessage(null);
    setAiActiveAction('risk');
    try {
      const res = await aiService.explainRisk(ctx);
      setAiResult(res);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to analyze risk factors.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiSuggestImprovements = async () => {
    const ctx = getQuotationAiContext();
    if (!ctx) return;
    setIsAiLoading(true);
    setAiLoadingMessage('Finding commercial concessions & margin upgrades...');
    setAiErrorMessage(null);
    setAiActiveAction('improvements');
    try {
      const res = await aiService.suggestImprovements(ctx);
      setAiResult(res);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to formulate improvements.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiDraftCustomerMessage = async () => {
    if (!activeQuote) return;
    setIsAiLoading(true);
    setAiLoadingMessage('Drafting customer follow-up message...');
    setAiErrorMessage(null);
    try {
      const res = await aiService.draftCustomerMessage({
        quotationCode: activeQuote.code,
        customerName: activeQuote.customerName,
        repName: activeQuote.repName || user.name || 'Sarah Chen',
        stage: activeQuote.stage,
        lastActivityAt: activeQuote.lastActivityAt,
        totalAmount: activeQuote.grandTotal,
      });
      const draftBody = res.rationale || '';
      const subject = `Update on quotation ${activeQuote.code} — ${activeQuote.customerName}`;
      setDraftModalContent({
        subject,
        body: draftBody,
        recipient: `${activeQuote.customerName} Procurement Desk`,
      });
      setIsDraftModalOpen(true);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to draft customer message.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiActionClick = (action: AIAction) => {
    if (action.type === 'add_product' && action.payload) {
      const productToAdd = products.find(
        (p) => p.id === action.payload?.productId || p.name === action.payload?.productName
      );
      if (productToAdd) {
        handleAddProduct(productToAdd);
        showToast(`Added ${productToAdd.name} to quotation based on AI optimization suggestion.`);
      } else {
        showToast(`Product ${action.payload?.productName || ''} added to quote draft.`);
      }
    } else if (action.type === 'draft_message') {
      handleAiDraftCustomerMessage();
    } else if (action.type === 'review_discount') {
      setIsRiskModalOpen(true);
    } else if (action.type === 'open_approval') {
      navigate(`/approvals/${activeQuote?.id}`);
    } else {
      showToast(`Action ${action.label} noted.`);
    }
  };

  // Filter products for the add line modal
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase());
      const matchesCategory = selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, productSearch, selectedCategoryFilter]);

  // Customer change handler
  const handleCustomerChange = (customerId: string) => {
    const selectedCust = customers.find((c) => c.id === customerId);
    if (!selectedCust || !activeQuote) return;

    if (isNew && newQuoteDraft) {
      const updatedDraft: Quotation = {
        ...newQuoteDraft,
        customerId: selectedCust.id,
        customerName: selectedCust.name,
        customerTier: selectedCust.tier as CustomerTier,
        priceListTier: selectedCust.tier as CustomerTier,
      };
      // Recalculate draft with new tier ceilings
      const recalculated = recalculateQuotation(updatedDraft);
      setNewQuoteDraft(recalculated);
      showToast(`Switched customer to ${selectedCust.name} (${selectedCust.tier} Tier). Pricing tier updated.`);
    } else {
      updateQuotation(activeQuote.id, {
        customerId: selectedCust.id,
        customerName: selectedCust.name,
        customerTier: selectedCust.tier as CustomerTier,
        priceListTier: selectedCust.tier as CustomerTier,
      });
      showToast(`Updated customer to ${selectedCust.name} (${selectedCust.tier} Tier). Governance limits synchronized.`);
    }
  };

  // Add line handler
  const handleAddProduct = (product: Product) => {
    if (!activeQuote) return;

    if (isNew && newQuoteDraft) {
      // If still local draft, persist to store on first added line or update local draft
      const basePrice = product.price ?? product.basePrice;
      const tierLimitResult = getEffectiveDiscountLimit(
        product.category,
        newQuoteDraft.customerTier || 'Gold'
      );
      const newLine: QuotationLine = {
        id: `LINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: 1,
        baseUnitPrice: basePrice,
        unitPrice: basePrice,
        discountPercent: 0,
        categoryLimitPercent: tierLimitResult.effectiveLimit,
        subtotal: basePrice,
        discountAmount: 0,
        lineTotal: basePrice,
        overBy: 0,
        lineStatus: 'OK',
        revenue: basePrice,
        cost: basePrice * ((product.costBasisPercent || 60) / 100),
        profit: basePrice * (1 - (product.costBasisPercent || 60) / 100),
        marginPercent: 100 - (product.costBasisPercent || 60),
        isSubscription: product.isSubscription,
        recurringCycle: product.recurringCycle,
      };

      const updatedLines = [...newQuoteDraft.lines, newLine];
      const recalculated = recalculateQuotation({
        ...newQuoteDraft,
        lines: updatedLines,
      });

      // Save as store quotation now so all features work reliably
      const created = createQuotation(recalculated);
      navigate(`/quotations/${created.id}`, { replace: true });
      showToast(`Added ${product.name} to order lines.`);
    } else {
      addQuotationLine(activeQuote.id, product.id, 1, 0);
      showToast(`Added ${product.name} to order lines.`);
    }

    setIsProductModalOpen(false);
  };

  // Remove line handler
  const handleRemoveLine = (lineId: string, lineName?: string) => {
    if (!activeQuote) return;
    removeQuotationLine(activeQuote.id, lineId);
    showToast(`Removed ${lineName || 'line item'} from quotation.`);
  };

  // Update line quantity handler
  const handleQuantityChange = (lineId: string, newQty: number) => {
    if (!activeQuote) return;
    const validQty = Math.max(1, newQty);
    updateLineQuantity(activeQuote.id, lineId, validQty);
  };

  // Update line discount handler (real-time typing)
  const handleDiscountChange = (lineId: string, discountPercent: number) => {
    if (!activeQuote) return;
    const sanitized = Math.max(0, Math.min(100, isNaN(discountPercent) ? 0 : discountPercent));
    updateLineDiscount(activeQuote.id, lineId, sanitized);
  };

  // Update order-level discount
  const handleOrderDiscountChange = (val: number) => {
    if (!activeQuote) return;
    const sanitized = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
    updateOrderDiscount(activeQuote.id, sanitized);
  };

  // Accept upsell suggestion handler
  const handleAcceptUpsell = (productId: string, productName: string) => {
    if (!activeQuote) return;
    addUpsellToQuotation(activeQuote.id, productId);
    showToast(`Upsell accepted: Added ${productName} to quotation lines.`);
  };

  // Dismiss upsell suggestion handler
  const handleDismissUpsell = (productId: string) => {
    if (!activeQuote) return;
    dismissUpsell(activeQuote.id, productId);
    showToast('Recommendation dismissed for this quotation.', 'info');
  };

  // Submit for approval / Auto-approve handler
  const handleSubmit = () => {
    if (!activeQuote) return;

    if (activeQuote.lines.length === 0) {
      showToast('Cannot submit an empty quotation. Please add at least one line item.', 'error');
      return;
    }

    const updated = submitQuotationForApproval(
      activeQuote.id,
      isReturnedForRevision ? 'Resubmitted after discount adjustments' : 'Submitted to commercial deal desk'
    );

    if (updated.stage === 'Approved') {
      showToast('Quotation compliant with tier limits: Auto-approved immediately!', 'success');
    } else {
      showToast(`Submitted for governance review. Assigned to ${updated.assignedApproverRole || 'Deal Desk'}.`, 'info');
    }
  };

  // Save draft handler
  const handleSaveDraft = () => {
    if (!activeQuote) return;
    logTimelineEvent(activeQuote.id, 'DRAFT_SAVED', 'Quotation draft updated and saved.');
    showToast('Quotation draft saved successfully.');
  };

  // If quotation not found
  if (!isNew && !existingQuote) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Quotation Not Found</h2>
        <p className="text-sm text-slate-600 mb-6">
          The quotation record <strong>{id}</strong> could not be located in the operational database.
        </p>
        <Link
          to="/quotations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#714B67] text-white rounded font-medium text-xs hover:bg-[#5e3d55] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations List
        </Link>
      </div>
    );
  }

  if (!activeQuote) return null;

  // Stages for the Odoo-inspired status bar
  const STAGES: QuotationStage[] = ['Draft', 'Pending Approval', 'Approved', 'Negotiation', 'Confirmed'];
  const currentStageIndex = STAGES.indexOf(
    activeQuote.stage === 'PendingApproval'
      ? 'Pending Approval'
      : activeQuote.stage === 'Returned for Revision' || activeQuote.stage === 'ReturnedForRevision'
      ? 'Draft'
      : activeQuote.stage
  );

  return (
    <div className="space-y-4 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded shadow-lg text-xs font-medium border ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : toastMessage.type === 'info'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : toastMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-600" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* 1. Breadcrumbs & Top Quick Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Link to="/dashboard" className="hover:text-slate-900 transition-colors">
            Workspace
          </Link>
          <span className="text-slate-400">/</span>
          <Link to="/quotations" className="hover:text-slate-900 transition-colors">
            Quotations
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-semibold text-slate-900 font-mono">{activeQuote.code}</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Register
          </Link>
        </div>
      </div>

      {/* Revision Alert Banner if Returned for Revision */}
      {isReturnedForRevision && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-amber-900 text-sm">Quotation Returned for Revision</h4>
              <p className="text-amber-800 mt-1">
                <strong>Reviewer Feedback:</strong>{' '}
                {activeQuote.revisionNote || 'Reduce Services discount and resubmit for commercial approval.'}
              </p>
              <p className="text-amber-700 mt-1 text-[11px]">
                Please adjust the flagged order line discounts within acceptable limits or attach business justification before resubmitting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Notice if locked */}
      {!isEditable && (
        <div className="bg-slate-100 border border-slate-300 p-3 rounded flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              This quotation is in <strong>{activeQuote.stage}</strong> stage and is locked from direct line modification.
            </span>
          </div>
          <StatusBadge status={activeQuote.stage} size="sm" />
        </div>
      )}

      {/* 2. Main Odoo Record Container */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Top Odoo Header: Action Controls + Stage Progression Bar */}
        <div className="border-b border-[#E5E7EB] bg-[#F8F9FA] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>

                {activeQuote.approvalRequired ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-[#714B67] hover:bg-[#5d3b53] border-[#714B67]"
                    icon={<Send className="w-3.5 h-3.5" />}
                    onClick={handleSubmit}
                  >
                    Submit for Approval
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    onClick={handleSubmit}
                  >
                    Confirm / Continue
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Stage:</span>
                <StatusBadge status={activeQuote.stage} size="md" />
              </div>
            )}

            {/* Smart Buttons (Odoo style) */}
            <div className="flex items-center gap-1 border-l border-slate-300 pl-2 ml-1">
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                title="View Audit Trail"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Audit ({quoteEvents.length})</span>
              </button>

              {quoteApprovalSteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/approvals/${activeQuote.id}`)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-800 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
                  title="View Approval Workflow"
                >
                  <UserCheck className="w-3 h-3 text-purple-600" />
                  <span>Approvals ({quoteApprovalSteps.length})</span>
                </button>
              )}

              {activeQuote.lines.some((l) => l.isSubscription) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded">
                  <Repeat className="w-3 h-3 text-indigo-600" />
                  <span>Subscription</span>
                </span>
              )}
            </div>
          </div>

          {/* Odoo Lifecycle Stages Progression Bar */}
          <div className="flex items-center self-stretch lg:self-auto overflow-x-auto py-1">
            <div className="inline-flex items-center border border-slate-200 rounded overflow-hidden shadow-2xs bg-white text-xs font-medium">
              {STAGES.map((stageName, idx) => {
                const isActive =
                  activeQuote.stage === stageName ||
                  (stageName === 'Pending Approval' && activeQuote.stage === 'PendingApproval') ||
                  (stageName === 'Draft' && isReturnedForRevision);

                const isCompleted = currentStageIndex > idx && !isReturnedForRevision;

                return (
                  <div
                    key={stageName}
                    className={`flex items-center px-3 py-1.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[#714B67] text-white font-bold'
                        : isCompleted
                        ? 'bg-emerald-50/70 text-emerald-900 font-medium'
                        : 'bg-white text-slate-400'
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 mr-1 text-emerald-600 stroke-[2.5]" />}
                    <span>{stageName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Record Title & Customer Banner */}
        <div className="p-5 border-b border-[#E5E7EB] bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {activeQuote.code}
                </h1>
                <RiskBadge
                  level={activeQuote.blendedRiskValue || activeQuote.blendedRiskLevel || 'LOW'}
                  score={activeQuote.blendedRiskScore}
                  size="md"
                />
                <StatusBadge status={activeQuote.stage} size="md" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Customer Quotation & Commercial Deal Sheet — Last evaluated {formatRelativeTime(activeQuote.lastActivityAt)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-500 block">Grand Total</span>
              <span className="text-2xl font-bold font-mono text-[#714B67]">
                {formatCurrency(activeQuote.grandTotal || 0)}
              </span>
              {activeQuote.lines.some((l) => l.isSubscription) && (
                <span className="text-[11px] text-purple-700 block font-mono">
                  + {formatCurrency(activeQuote.lines.filter((l) => l.isSubscription).reduce((s, l) => s + l.lineTotal, 0))}/mo Recurring
                </span>
              )}
            </div>
          </div>

          {/* Customer / Commercial Header Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 text-xs">
            {/* Customer Selector */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Customer
              </label>
              {isEditable ? (
                <select
                  value={activeQuote.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.tier} Tier)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="font-semibold text-slate-900 py-1">{activeQuote.customerName}</div>
              )}
            </div>

            {/* Customer Tier & Price List */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Pricing Agreement & Tier
              </label>
              <div className="flex items-center gap-2 py-1">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    activeQuote.customerTier === 'Gold'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : activeQuote.customerTier === 'Silver'
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-amber-700/10 text-amber-800 border border-amber-300/40'
                  }`}
                >
                  {activeQuote.customerTier || 'Gold'} Tier
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  PL-{activeQuote.priceListTier || activeQuote.customerTier}
                </span>
              </div>
            </div>

            {/* Assigned Sales Rep */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Assigned Representative
              </label>
              <div className="font-semibold text-slate-900 py-1">
                {activeQuote.repName || 'Sarah Chen'}
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Quotation Expiry
              </label>
              <div className="font-mono text-slate-800 py-1">
                {activeQuote.expirationDate || '14 days from creation'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Two-Column Workspace Layout (Left: Order Lines & Totals, Right: Sticky Governance) */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Main Work Area (Left Column, col-span-8 or 9) */}
          <div className="lg:col-span-8 xl:col-span-9 p-5 border-b lg:border-b-0 lg:border-r border-[#E5E7EB] space-y-6">
            {/* Lines Section Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Order Lines</h3>
                <p className="text-[11px] text-slate-500">
                  Continuous inline discount governance and line-level margin analysis.
                </p>
              </div>

              {isEditable && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsProductModalOpen(true)}
                  className="bg-[#714B67] hover:bg-[#5d3b53] border-[#714B67]"
                >
                  + Add Product
                </Button>
              )}
            </div>

            {/* Order Lines Table */}
            <div className="border border-slate-200 rounded-md overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                    <th className="px-3.5 py-2.5">Product & SKU</th>
                    <th className="px-2.5 py-2.5">Category</th>
                    <th className="px-2.5 py-2.5 text-center w-24">Quantity</th>
                    <th className="px-2.5 py-2.5 text-right">Unit Price</th>
                    <th className="px-3 py-2.5 text-center w-24">Discount %</th>
                    <th className="px-2.5 py-2.5 text-center">Allowed Limit</th>
                    <th className="px-2.5 py-2.5 text-center">Over By</th>
                    <th className="px-2.5 py-2.5 text-right">Margin %</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    {isEditable && <th className="px-2 py-2.5 w-10 text-center"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activeQuote.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isEditable ? 10 : 9}
                        className="py-10 text-center text-slate-400 bg-slate-50/50"
                      >
                        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-700">No order lines added yet</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Click "+ Add Product" above to add products, services, or subscriptions.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    activeQuote.lines.map((line) => {
                      const isOver = line.overBy > 0;

                      return (
                        <tr
                          key={line.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isOver ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Product Name & Details */}
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{line.productName}</span>
                              {line.isSubscription && (
                                <span className="text-[10px] px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-medium">
                                  Recurring
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Base: {formatCurrency(line.baseUnitPrice)}
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="px-2.5 py-3">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                line.category === 'Hardware'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : line.category === 'Services'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-purple-50 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {line.category}
                            </span>
                          </td>

                          {/* Quantity Controls */}
                          <td className="px-2.5 py-3">
                            {isEditable ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold"
                                  disabled={line.quantity <= 1}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) => handleQuantityChange(line.id, parseInt(e.target.value) || 1)}
                                  className="w-10 text-center py-0.5 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="text-center font-mono font-semibold text-slate-800">
                                {line.quantity}
                              </div>
                            )}
                          </td>

                          {/* Unit Price */}
                          <td className="px-2.5 py-3 text-right font-mono text-slate-700">
                            {formatCurrency(line.unitPrice)}
                          </td>

                          {/* Discount % with live typing update */}
                          <td className="px-3 py-3">
                            {isEditable ? (
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={line.discountPercent}
                                  onChange={(e) =>
                                    handleDiscountChange(line.id, parseFloat(e.target.value))
                                  }
                                  className={`w-16 px-1.5 py-1 text-center font-mono font-bold text-xs border rounded transition-colors focus:outline-hidden focus:ring-1 ${
                                    isOver
                                      ? 'border-rose-300 bg-rose-50 text-rose-900 focus:ring-rose-500'
                                      : 'border-slate-300 bg-white text-slate-900 focus:ring-[#714B67]'
                                  }`}
                                />
                                <span className="ml-1 text-[11px] text-slate-500">%</span>
                              </div>
                            ) : (
                              <div className="text-center font-mono font-bold text-slate-800">
                                {line.discountPercent}%
                              </div>
                            )}
                          </td>

                          {/* Allowed Limit */}
                          <td className="px-2.5 py-3 text-center">
                            <span className="font-mono text-xs text-slate-600">
                              {line.categoryLimitPercent}%
                            </span>
                          </td>

                          {/* Over By Status Badge */}
                          <td className="px-2.5 py-3 text-center">
                            {isOver ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono"
                                title={`Discount exceeded by ${line.overBy} percentage points!`}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                +{line.overBy.toFixed(1)} pts
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                                <Check className="w-3 h-3 text-emerald-600" />
                                0 pts (OK)
                              </span>
                            )}
                          </td>

                          {/* Margin % */}
                          <td className="px-2.5 py-3 text-right">
                            <span
                              className={`font-mono font-bold ${
                                line.marginPercent >= 40
                                  ? 'text-emerald-700'
                                  : line.marginPercent >= 25
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {line.marginPercent.toFixed(1)}%
                            </span>
                          </td>

                          {/* Line Total */}
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(line.lineTotal)}
                          </td>

                          {/* Delete Action */}
                          {isEditable && (
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(line.id, line.productName)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Order-Level Discount Row */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Order-Level Additional Discount:</span>
                {isEditable ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={activeQuote.orderDiscountPercent || 0}
                      onChange={(e) => handleOrderDiscountChange(parseFloat(e.target.value))}
                      className="w-14 px-1.5 py-0.5 text-center font-mono font-bold border border-slate-300 rounded bg-white"
                    />
                    <span className="text-slate-500 font-mono">%</span>
                  </div>
                ) : (
                  <span className="font-mono font-bold text-slate-800">
                    {activeQuote.orderDiscountPercent || 0}%
                  </span>
                )}
              </div>

              {activeQuote.orderDiscountAmount ? (
                <span className="text-slate-600 font-mono">
                  Deduction: -{formatCurrency(activeQuote.orderDiscountAmount)}
                </span>
              ) : null}
            </div>

            {/* Financial Totals Breakdown */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 space-y-2 text-xs border border-slate-200 rounded-md p-4 bg-white shadow-2xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Base List):</span>
                  <span className="font-mono font-medium">{formatCurrency(activeQuote.subtotal || 0)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Line & Order Discounts:</span>
                  <span className="font-mono font-medium text-rose-700">
                    -{formatCurrency(activeQuote.totalDiscount || 0)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Taxable Net Amount:</span>
                  <span className="font-mono font-medium">{formatCurrency(activeQuote.taxableAmount || activeQuote.revenue || 0)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Estimated Tax (10%):</span>
                  <span className="font-mono font-medium">{formatCurrency(activeQuote.tax || 0)}</span>
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base text-[#714B67]">
                    {formatCurrency(activeQuote.grandTotal || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Tabs for Governance Log, Notes, and Audit Trail */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600 space-x-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('lines')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'lines'
                      ? 'border-[#714B67] text-[#714B67]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Order Lines Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('governance')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'governance'
                      ? 'border-[#714B67] text-[#714B67]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Governance Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'notes'
                      ? 'border-[#714B67] text-[#714B67]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Internal Notes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'audit'
                      ? 'border-[#714B67] text-[#714B67]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Audit Trail ({quoteEvents.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="pt-4 text-xs">
                {activeTab === 'lines' && (
                  <div className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                    <p>
                      Displaying active order lines evaluated under <strong>{activeQuote.customerTier} Tier</strong> commercial price rules.
                      Changes to order line quantities or discounts immediately execute the discount governance matrix, recomputing gross margin and routing requirements without page refresh.
                    </p>
                  </div>
                )}

                {activeTab === 'governance' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-2">Evaluated Ceiling Rules:</h4>
                      <ul className="space-y-1.5 text-slate-700">
                        <li className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span>Hardware Category Limit:</span>
                          <span className="font-mono font-semibold">15% Max Ceiling</span>
                        </li>
                        <li className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span>Services Category Limit:</span>
                          <span className="font-mono font-semibold">10% Stricter Ceiling</span>
                        </li>
                        <li className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span>Subscription Category Limit:</span>
                          <span className="font-mono font-semibold">15% Max Ceiling</span>
                        </li>
                        <li className="flex items-center justify-between pt-1">
                          <span>Customer Tier Ceiling ({activeQuote.customerTier}):</span>
                          <span className="font-mono font-semibold">
                            {activeQuote.customerTier === 'Gold' ? '15%' : activeQuote.customerTier === 'Silver' ? '10%' : '5%'} Max
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">Salesperson Internal Memo:</label>
                    <textarea
                      rows={3}
                      value={activeQuote.notes || ''}
                      disabled={!isEditable}
                      onChange={(e) => updateQuotation(activeQuote.id, { notes: e.target.value })}
                      placeholder="Enter deal notes, customer negotiation requirements, or special delivery terms..."
                      className="w-full p-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-hidden disabled:bg-slate-100"
                    />
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="space-y-2">
                    {quoteEvents.length === 0 ? (
                      <p className="text-slate-400 py-3">No activity recorded for this quotation yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {quoteEvents.map((evt) => (
                          <div key={evt.id} className="py-2 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800">{evt.description}</div>
                              <div className="text-[10px] text-slate-400">
                                Event Type: <span className="font-mono">{evt.type}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                              {formatExactDateTime(evt.timestamp)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Governance & Intelligence Panel (col-span-4 or 3) */}
          <div className="lg:col-span-4 xl:col-span-3 p-5 bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#714B67]" /> Deal Governance
              </span>
              <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">
                LIVE
              </span>
            </div>

            {/* 1. Blended Risk Meter Card */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Blended Risk Level</span>
                <RiskBadge
                  level={activeQuote.blendedRiskValue || activeQuote.blendedRiskLevel || 'LOW'}
                  score={activeQuote.blendedRiskScore}
                  size="md"
                />
              </div>

              {/* Progress score bar */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Calculated Risk Score</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeQuote.blendedRiskScore} / 100
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      (activeQuote.blendedRiskValue || 'LOW') === 'HIGH'
                        ? 'bg-rose-500'
                        : (activeQuote.blendedRiskValue || 'LOW') === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(8, activeQuote.blendedRiskScore))}%` }}
                  />
                </div>
              </div>

              {/* Over by Summary Explanation */}
              {activeQuote.lines.some((l) => l.overBy > 0) ? (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-rose-800 font-semibold mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Ceiling Violations Flagged:
                  </div>
                  <ul className="text-[11px] text-rose-700 space-y-0.5">
                    {activeQuote.lines
                      .filter((l) => l.overBy > 0)
                      .map((l) => (
                        <li key={l.id} className="truncate">
                          • {l.productName}: <strong>+{l.overBy} pts</strong> over {l.category} limit ({l.categoryLimitPercent}%)
                        </li>
                      ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setIsRiskModalOpen(true)}
                    className="mt-2 text-[11px] font-semibold text-[#714B67] hover:underline flex items-center gap-1"
                  >
                    Why is this quote at risk? <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-800 bg-emerald-50/60 border border-emerald-200 p-2 rounded flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>All lines are fully compliant with category & tier discount ceilings.</span>
                </div>
              )}
            </div>

            {/* 2. Projected Margin Card */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
              <MarginIndicator
                currentMarginPercent={activeQuote.marginPercent || 40}
                targetMarginPercent={40}
                floorMarginPercent={25}
                size="md"
                showDetails={true}
              />
              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                <span>Total Profit:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(activeQuote.profit || 0)}
                </span>
              </div>
            </div>

            {/* 3. Approval Routing Requirement Preview */}
            <div
              className={`p-4 rounded-lg border shadow-2xs space-y-2 ${
                activeQuote.approvalRequired
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-emerald-50/40 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Approval Requirement</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    activeQuote.approvalRequired
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {activeQuote.approvalRequired ? 'REQUIRED' : 'AUTO-APPROVED'}
                </span>
              </div>

              {activeQuote.approvalRequired ? (
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="text-[11px] text-slate-600">
                    Discounts exceed self-governing threshold.
                  </p>
                  <div className="pt-1 font-semibold text-[11px]">
                    Expected Approval Path:
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-800">
                    {activeQuote.requiredApprovers.map((role, idx) => (
                      <React.Fragment key={role}>
                        <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-semibold">
                          {role === 'sales_manager' ? 'Sales Manager' : 'Finance Director'}
                        </span>
                        {idx < activeQuote.requiredApprovers.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-amber-600" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Within approved self-governing limits. This quotation qualifies for instant confirmation without deal desk escalation.
                </p>
              )}
            </div>

            {/* 4. AI Recommended Upsell & Cross-Sell Opportunities */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Recommended Add-ons
                </span>
                <span className="text-[10px] text-purple-700 font-mono font-medium">
                  {suggestions.length} Active
                </span>
              </div>

              {suggestions.length === 0 ? (
                <div className="p-3 bg-white border border-slate-200 rounded text-center text-[11px] text-slate-400">
                  No pending cross-sell recommendations for current lines.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {suggestions.map((sugg) => (
                    <div
                      key={sugg.id}
                      className="p-3 bg-purple-50/40 border border-purple-200 rounded-md hover:border-purple-300 transition-all text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{sugg.productName}</div>
                          <span className="text-[10px] text-purple-700 font-medium">
                            {sugg.targetCategory}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          +{sugg.marginDelta}% Margin
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {sugg.reason}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-purple-100">
                        <button
                          type="button"
                          onClick={() => handleDismissUpsell(sugg.productId)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 px-2 py-0.5"
                        >
                          Dismiss
                        </button>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleAcceptUpsell(sugg.productId, sugg.productName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#714B67] hover:bg-[#5d3b53] text-white rounded text-[11px] font-medium transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add to Quote
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Deal Copilot AI Assistance Panel (Section 13, 14, 15, 61, 62) */}
            <div id="quotation-deal-copilot" className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Deal Copilot
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded font-mono uppercase">
                  Advisory
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="btn-ai-summarize-deal"
                  onClick={handleAiSummarize}
                  disabled={isAiLoading || !activeQuote?.lines?.length}
                  className="px-2 py-1.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded text-left text-[11px] font-semibold text-slate-800 hover:text-indigo-950 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Summarize Deal</span>
                </button>

                <button
                  type="button"
                  id="btn-ai-explain-risk"
                  onClick={handleAiExplainRisk}
                  disabled={isAiLoading || !activeQuote?.lines?.length}
                  className="px-2 py-1.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded text-left text-[11px] font-semibold text-slate-800 hover:text-indigo-950 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Explain Risk</span>
                </button>

                <button
                  type="button"
                  id="btn-ai-suggest-improvements"
                  onClick={handleAiSuggestImprovements}
                  disabled={isAiLoading || !activeQuote?.lines?.length}
                  className="px-2 py-1.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded text-left text-[11px] font-semibold text-slate-800 hover:text-indigo-950 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Improvements</span>
                </button>

                <button
                  type="button"
                  id="btn-ai-draft-message"
                  onClick={handleAiDraftCustomerMessage}
                  disabled={isAiLoading || !activeQuote?.lines?.length}
                  className="px-2 py-1.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded text-left text-[11px] font-semibold text-slate-800 hover:text-indigo-950 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Draft Message</span>
                </button>
              </div>

              {/* Mounted Insight Panel */}
              <AIInsightPanel
                title="Deal Copilot Analysis"
                result={aiResult}
                isLoading={isAiLoading}
                loadingMessage={aiLoadingMessage}
                errorMessage={aiErrorMessage}
                onRetry={aiActiveAction === 'summary' ? handleAiSummarize : aiActiveAction === 'risk' ? handleAiExplainRisk : handleAiSuggestImprovements}
                onRefresh={aiActiveAction === 'summary' ? handleAiSummarize : aiActiveAction === 'risk' ? handleAiExplainRisk : handleAiSuggestImprovements}
                stale={activeQuote ? aiService.isResultStale(activeQuote.id, aiActiveAction || 'summary', activeQuote.updatedAt) : false}
                onActionClick={handleAiActionClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#714B67]" />
                <h3 className="font-bold text-slate-900 text-sm">Add Product to Quotation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="p-3 border-b border-slate-200 bg-white space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog by product name, SKU, or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {['All', 'Hardware', 'Services', 'Subscription'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedCategoryFilter === cat
                        ? 'bg-[#714B67] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 text-xs">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No products matched your search.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const alreadyInQuote = activeQuote.lines.some((l) => l.productId === p.id);

                  return (
                    <div
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              p.category === 'Hardware'
                                ? 'bg-blue-50 text-blue-700'
                                : p.category === 'Services'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-purple-50 text-purple-800'
                            }`}
                          >
                            {p.category}
                          </span>
                          {p.isSubscription && (
                            <span className="text-[10px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-medium">
                              Recurring
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-900">
                            {formatCurrency(p.price ?? p.basePrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            /{p.unit || 'unit'}
                          </span>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddProduct(p)}
                          disabled={alreadyInQuote}
                          className="bg-[#714B67] hover:bg-[#5d3b53]"
                        >
                          {alreadyInQuote ? 'In Quote' : 'Select'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-[#F8F9FA] flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProductModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* "Why This Quote is Risky" Governance Breakdown Modal */}
      {isRiskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Deal Risk & Governance Explanation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRiskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 text-xs space-y-4">
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Blended Risk Assessment:</h4>
                <p className="text-slate-600 leading-relaxed">
                  DealFlow360 evaluates each line item against the customer&apos;s tier ceilings and product category discount thresholds.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-800">Flagged Exceptions on this Quote:</h4>
                {activeQuote.lines
                  .filter((l) => l.overBy > 0)
                  .map((l) => (
                    <div key={l.id} className="p-2.5 bg-rose-50 border border-rose-200 rounded">
                      <div className="flex justify-between font-bold text-rose-900">
                        <span>{l.productName}</span>
                        <span>+{l.overBy} pts over ceiling</span>
                      </div>
                      <div className="text-[11px] text-rose-700 mt-1">
                        Discount Given: <strong>{l.discountPercent}%</strong> | Category Ceilings: <strong>{l.categoryLimitPercent}%</strong>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] leading-relaxed">
                <strong>Governance Rule Applied:</strong> Any quotation with a discount overage &gt; 5 points triggers a <strong>HIGH RISK</strong> classification and automatically routes for two-step sign-off (Sales Operations Deal Desk + Commercial Finance).
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-[#F8F9FA] flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRiskModalOpen(false)}
                className="bg-[#714B67]"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Draft Editor Modal (Section 47) */}
      <AIDraftEditorModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        title="Review AI Customer Follow-Up Draft"
        initialSubject={draftModalContent.subject}
        initialBody={draftModalContent.body}
        recipientLabel={draftModalContent.recipient}
        actionButtonLabel="Save Draft to Notes"
        onApplyOrSend={(editedBody, editedSubject) => {
          if (activeQuote) {
            const currentNotes = activeQuote.notes || '';
            const newNotes = currentNotes
              ? `${currentNotes}\n\n--- AI Follow-Up Draft ---\n${editedBody}`
              : `--- AI Follow-Up Draft ---\n${editedBody}`;
            updateQuotation(activeQuote.id, { notes: newNotes });
            showToast('AI follow-up draft appended to quotation internal notes.');
          }
        }}
      />
    </div>
  );
};
