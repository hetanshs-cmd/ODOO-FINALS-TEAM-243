import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Clock,
  FileText,
  X,
  Search,
  Check,
  UserCheck,
  Layers,
  Building2,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react';
import { useQuotation } from '../hooks/useQuotations';
import { useCustomers } from '../hooks/useCustomers';
import { useApprovals } from '../hooks/useApprovals';
import { quotationService, adminService, dealHealthService, productService, isForbiddenError } from '../services';
import { ApiError } from '../services/httpClient';
import {
  ApiProduct,
  ApiProductCategory,
  ApiQuotationItem,
  ApiRecommendation,
  ApiDealHealthScore,
} from '../services/apiTypes';
import { formatCurrency, formatExactDateTime, humanizeStatus } from '../utils/formatters';
import { MarginIndicator } from '../components/domain/MarginIndicator';
import { RiskBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { RiskLevel } from '../types';

// Real quotation.status values, bucketed into a 4-stage progression for the
// header bar. Several real statuses (REJECTED/DECLINED/EXPIRED/CANCELLED)
// have no place on a "moving forward" bar and just show as their own badge.
const STAGE_BUCKETS: { label: string; statuses: string[] }[] = [
  { label: 'Draft', statuses: ['DRAFT'] },
  { label: 'Review', statuses: ['SUBMITTED', 'PENDING_APPROVAL', 'NEGOTIATION'] },
  { label: 'Approved', statuses: ['APPROVED', 'SENT_TO_CUSTOMER', 'ACCEPTED'] },
  { label: 'Converted', statuses: ['CONVERTED'] },
];
const TERMINAL_STATUSES = new Set(['REJECTED', 'DECLINED', 'EXPIRED', 'CANCELLED']);

function riskLevelFromScore(riskLevel?: string): RiskLevel {
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') return 'HIGH';
  if (riskLevel === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

export const QuotationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { quotation, loading: quoteLoading, error: quoteError, refetch: refetchQuotation } = useQuotation(
    isNew ? undefined : id
  );
  const { customers } = useCustomers();
  const { approvals } = useApprovals(quotation ? { quotation_id: quotation.id } : undefined);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiProductCategory[]>([]);
  const [catalogForbidden, setCatalogForbidden] = useState(false);
  useEffect(() => {
    Promise.all([productService.getAll(), adminService.productCategories.list()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((err) => {
        if (isForbiddenError(err)) setCatalogForbidden(true);
      });
  }, []);
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const [dealHealth, setDealHealth] = useState<ApiDealHealthScore | null>(null);
  const refetchDealHealth = React.useCallback(() => {
    if (!quotation) return;
    dealHealthService
      .getForQuotation(quotation.id)
      .then((res) => setDealHealth(res.score))
      .catch(() => setDealHealth(null));
  }, [quotation?.id]);
  useEffect(() => {
    refetchDealHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?.id]);

  const [timeline, setTimeline] = useState<{ id: string; action: string; created_at: string }[]>([]);
  useEffect(() => {
    if (!quotation) return;
    quotationService.getTimeline(quotation.id).then(setTimeline).catch(() => setTimeline([]));
  }, [quotation?.id]);

  const [recommendations, setRecommendations] = useState<ApiRecommendation[]>([]);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!quotation || quotation.items.length === 0) {
      setRecommendations([]);
      return;
    }
    const productIds: string[] = Array.from(new Set(quotation.items.map((i) => i.product_id)));
    Promise.all(
      productIds.map((pid) => productService.getRecommendations(pid).catch((): ApiRecommendation[] => [])),
    )
      .then((results) => {
        const inQuote = new Set(quotation.items.map((i) => i.product_id));
        const seen = new Set<string>();
        const flat: ApiRecommendation[] = [];
        for (const list of results) {
          for (const rec of list) {
            if (inQuote.has(rec.recommended_product_id) || seen.has(rec.recommended_product_id)) continue;
            seen.add(rec.recommended_product_id);
            flat.push(rec);
          }
        }
        setRecommendations(flat);
      })
      .catch(() => setRecommendations([]));
  }, [quotation?.id, quotation?.items.length]);

  // Local editable mirror of quantity/discount so typing feels immediate;
  // commits to the real API on blur rather than one request per keystroke.
  const [editState, setEditState] = useState<Record<string, { quantity: string; discount_percent: string }>>({});
  useEffect(() => {
    if (!quotation) return;
    const next: Record<string, { quantity: string; discount_percent: string }> = {};
    for (const item of quotation.items) {
      next[item.id] = { quantity: item.quantity, discount_percent: item.discount_percent };
    }
    setEditState(next);
  }, [quotation?.items]);
  const [orderDiscountInput, setOrderDiscountInput] = useState('0');
  useEffect(() => {
    if (quotation) setOrderDiscountInput(quotation.order_discount_percent);
  }, [quotation?.order_discount_percent]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'lines' | 'governance' | 'notes' | 'audit'>('lines');
  const [sessionNotes, setSessionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // --- New quotation creation (id === 'new') ---------------------------------
  const [draftCustomerId, setDraftCustomerId] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('USD');
  const [isCreating, setIsCreating] = useState(false);
  useEffect(() => {
    if (isNew && !draftCustomerId && customers.length > 0) {
      setDraftCustomerId(customers[0].id);
    }
  }, [isNew, customers, draftCustomerId]);

  const handleCreateQuotation = async () => {
    if (!draftCustomerId) {
      toast.error('Select a customer', 'Choose a customer before creating the quotation.');
      return;
    }
    setIsCreating(true);
    try {
      const created = await quotationService.create({ customer_id: draftCustomerId, currency: draftCurrency });
      toast.success('Quotation Created', `${created.quotation_number} is ready for line items.`);
      navigate(`/quotations/${created.id}`, { replace: true });
    } catch (err) {
      toast.error('Could not create quotation', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isNew) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <h2 className="text-lg font-bold text-slate-900 mb-1">New Quotation</h2>
        <p className="text-xs text-slate-500 mb-6">
          Pick a customer to start a draft — you'll add products on the next screen.
        </p>
        <div className="space-y-4 bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
            <select
              value={draftCustomerId}
              onChange={(e) => setDraftCustomerId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.tier ? `(${c.tier} Tier)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <input
              value={draftCurrency}
              onChange={(e) => setDraftCurrency(e.target.value.toUpperCase().slice(0, 3))}
              className="w-24 px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleCreateQuotation} disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Create Quotation'}
          </Button>
        </div>
      </div>
    );
  }

  if (quoteError && quoteError.isNotFound) {
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

  if (quoteLoading || !quotation) {
    return <p className="text-xs text-slate-500 py-12 text-center">Loading quotation…</p>;
  }

  const isEditable = quotation.status === 'DRAFT';
  const customer = customersById.get(quotation.customer_id);
  const currentApproval = approvals.find((a) => a.status === 'PENDING' || a.status === 'ESCALATED');

  const filteredProducts = products.filter((p) => {
    const categoryName = p.category_id ? categoriesById.get(p.category_id) || '' : '';
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
      categoryName.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'All' || categoryName === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const itemsWithMargin = quotation.items.filter((i) => i.margin_percent !== null && i.margin_percent !== undefined);
  const avgMarginPercent =
    itemsWithMargin.length > 0
      ? itemsWithMargin.reduce((sum, i) => sum + Number(i.margin_percent), 0) / itemsWithMargin.length
      : null;

  const handleAddProduct = async (product: ApiProduct) => {
    try {
      await quotationService.addItem(quotation.id, {
        product_id: product.id,
        quantity: 1,
        unit_price: Number(product.base_price ?? product.price ?? 0),
        billing_type: (product.product_type as 'ONE_TIME' | 'RECURRING') || 'ONE_TIME',
      });
      toast.success('Line added', `${product.name} added to the quotation.`);
      await refetchQuotation();
      refetchDealHealth();
      setIsProductModalOpen(false);
    } catch (err) {
      toast.error('Could not add product', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const handleRemoveLine = async (item: ApiQuotationItem) => {
    try {
      await quotationService.removeItem(quotation.id, item.id);
      toast.success('Line removed');
      await refetchQuotation();
      refetchDealHealth();
    } catch (err) {
      toast.error('Could not remove line', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  const commitItemEdit = async (itemId: string, field: 'quantity' | 'discount_percent', rawValue: string) => {
    const numeric = parseFloat(rawValue);
    if (isNaN(numeric)) return;
    const sanitized = field === 'quantity' ? Math.max(1, numeric) : Math.max(0, Math.min(100, numeric));
    setSavingItemId(itemId);
    try {
      await quotationService.updateItem(quotation.id, itemId, { [field]: sanitized });
      await refetchQuotation();
      refetchDealHealth();
    } catch (err) {
      toast.error('Could not update line', err instanceof ApiError ? err.message : 'Please try again.');
      await refetchQuotation();
    } finally {
      setSavingItemId(null);
    }
  };

  const commitOrderDiscount = async () => {
    const numeric = parseFloat(orderDiscountInput);
    if (isNaN(numeric)) return;
    const sanitized = Math.max(0, Math.min(100, numeric));
    try {
      await quotationService.update(quotation.id, { order_discount_percent: sanitized });
      toast.success('Order discount updated');
      await refetchQuotation();
      refetchDealHealth();
    } catch (err) {
      toast.error('Could not update order discount', err instanceof ApiError ? err.message : 'Please try again.');
      await refetchQuotation();
    }
  };

  const handleSubmit = async () => {
    if (quotation.items.length === 0) {
      toast.error('Cannot submit an empty quotation', 'Add at least one line item first.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await quotationService.submit(quotation.id);
      if (updated.status === 'APPROVED') {
        toast.success('Auto-approved', 'Quotation is within self-governing discount limits.');
      } else if (updated.status === 'PENDING_APPROVAL') {
        toast.info('Submitted for approval', 'Routed for governance review.');
      } else {
        toast.info('Submitted', `Quotation is now ${humanizeStatus(updated.status)}.`);
      }
      await refetchQuotation();
    } catch (err) {
      toast.error('Could not submit', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBucketIndex = STAGE_BUCKETS.findIndex((b) => b.statuses.includes(quotation.status));

  return (
    <div className="space-y-4 pb-16">
      {/* Breadcrumbs & Top Quick Nav */}
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
          <span className="font-semibold text-slate-900 font-mono">{quotation.quotation_number}</span>
        </div>
        <Link
          to="/quotations"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Register
        </Link>
      </div>

      {!isEditable && (
        <div className="bg-slate-100 border border-slate-300 p-3 rounded flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              This quotation is <strong>{humanizeStatus(quotation.status)}</strong> and locked from line modification.
            </span>
          </div>
          <StatusBadge status={humanizeStatus(quotation.status)} size="sm" />
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Header: Action Controls + Stage Bar */}
        <div className="border-b border-[#E5E7EB] bg-[#F8F9FA] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <Button
                variant="primary"
                size="sm"
                className="bg-[#714B67] hover:bg-[#5d3b53] border-[#714B67]"
                icon={<Send className="w-3.5 h-3.5" />}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Status:</span>
                <StatusBadge status={humanizeStatus(quotation.status)} size="md" />
              </div>
            )}

            <div className="flex items-center gap-1 border-l border-slate-300 pl-2 ml-1">
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Audit ({timeline.length})</span>
              </button>

              {currentApproval && (
                <button
                  type="button"
                  onClick={() => navigate(`/approvals/${quotation.id}`)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-800 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
                >
                  <UserCheck className="w-3 h-3 text-purple-600" />
                  <span>Approval: {humanizeStatus(currentApproval.status)}</span>
                </button>
              )}
            </div>
          </div>

          {!TERMINAL_STATUSES.has(quotation.status) && (
            <div className="flex items-center self-stretch lg:self-auto overflow-x-auto py-1">
              <div className="inline-flex items-center border border-slate-200 rounded overflow-hidden shadow-2xs bg-white text-xs font-medium">
                {STAGE_BUCKETS.map((bucket, idx) => {
                  const isActive = idx === currentBucketIndex;
                  const isCompleted = currentBucketIndex > idx;
                  return (
                    <div
                      key={bucket.label}
                      className={`flex items-center px-3 py-1.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-[#714B67] text-white font-bold'
                          : isCompleted
                          ? 'bg-emerald-50/70 text-emerald-900 font-medium'
                          : 'bg-white text-slate-400'
                      }`}
                    >
                      {isCompleted && <Check className="w-3 h-3 mr-1 text-emerald-600 stroke-[2.5]" />}
                      <span>{bucket.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Record Title & Customer Banner */}
        <div className="p-5 border-b border-[#E5E7EB] bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {quotation.quotation_number}
                </h1>
                <StatusBadge status={humanizeStatus(quotation.status)} size="md" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {customer?.name || 'Unnamed Customer'} — Last updated {formatExactDateTime(quotation.updated_at)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-500 block">Grand Total</span>
              <span className="text-2xl font-bold font-mono text-[#714B67]">
                {formatCurrency(Number(quotation.grand_total))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Customer
              </label>
              <div className="font-semibold text-slate-900 py-1">{customer?.name || 'Unnamed Customer'}</div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Tier
              </label>
              <div className="py-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  {customer?.tier || 'Standard'}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Currency
              </label>
              <div className="font-semibold text-slate-900 py-1 font-mono">{quotation.currency}</div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Valid Until
              </label>
              <div className="font-mono text-slate-800 py-1">{quotation.valid_until || 'No expiry set'}</div>
            </div>
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9 p-5 border-b lg:border-b-0 lg:border-r border-[#E5E7EB] space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Order Lines</h3>
                <p className="text-[11px] text-slate-500">Real line items, priced and discounted per unit.</p>
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

            <div className="border border-slate-200 rounded-md overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                    <th className="px-3.5 py-2.5">Product</th>
                    <th className="px-2.5 py-2.5">Category</th>
                    <th className="px-2.5 py-2.5 text-center w-24">Quantity</th>
                    <th className="px-2.5 py-2.5 text-right">Unit Price</th>
                    <th className="px-3 py-2.5 text-center w-24">Discount %</th>
                    <th className="px-2.5 py-2.5 text-right">Margin %</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    {isEditable && <th className="px-2 py-2.5 w-10 text-center"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {quotation.items.length === 0 ? (
                    <tr>
                      <td colSpan={isEditable ? 8 : 7} className="py-10 text-center text-slate-400 bg-slate-50/50">
                        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-700">No order lines added yet</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Click "+ Add Product" above to add products from the real catalog.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    quotation.items.map((item) => {
                      const product = productsById.get(item.product_id);
                      const categoryName = product?.category_id ? categoriesById.get(product.category_id) : undefined;
                      const edit = editState[item.id] || { quantity: item.quantity, discount_percent: item.discount_percent };
                      const margin = item.margin_percent;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-slate-900">{product?.name || item.description || 'Product'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{product?.sku || ''}</div>
                          </td>
                          <td className="px-2.5 py-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {categoryName || '—'}
                            </span>
                          </td>
                          <td className="px-2.5 py-3">
                            {isEditable ? (
                              <input
                                type="number"
                                min="1"
                                value={edit.quantity}
                                disabled={savingItemId === item.id}
                                onChange={(e) => setEditState((s) => ({ ...s, [item.id]: { ...s[item.id], quantity: e.target.value } }))}
                                onBlur={(e) => commitItemEdit(item.id, 'quantity', e.target.value)}
                                className="w-16 text-center py-0.5 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-hidden"
                              />
                            ) : (
                              <div className="text-center font-mono font-semibold text-slate-800">{item.quantity}</div>
                            )}
                          </td>
                          <td className="px-2.5 py-3 text-right font-mono text-slate-700">
                            {formatCurrency(Number(item.unit_price))}
                          </td>
                          <td className="px-3 py-3">
                            {isEditable ? (
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={edit.discount_percent}
                                  disabled={savingItemId === item.id}
                                  onChange={(e) => setEditState((s) => ({ ...s, [item.id]: { ...s[item.id], discount_percent: e.target.value } }))}
                                  onBlur={(e) => commitItemEdit(item.id, 'discount_percent', e.target.value)}
                                  className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
                                />
                                <span className="ml-1 text-[11px] text-slate-500">%</span>
                              </div>
                            ) : (
                              <div className="text-center font-mono font-bold text-slate-800">{item.discount_percent}%</div>
                            )}
                          </td>
                          <td className="px-2.5 py-3 text-right">
                            {margin === null || margin === undefined ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span
                                className={`font-mono font-bold ${
                                  margin >= 40 ? 'text-emerald-700' : margin >= 25 ? 'text-amber-700' : 'text-rose-700'
                                }`}
                              >
                                {Number(margin).toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(Number(item.line_total))}
                          </td>
                          {isEditable && (
                            <td className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(item)}
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

            {/* Order-Level Discount */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">Order-Level Additional Discount:</span>
              {isEditable ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={orderDiscountInput}
                    onChange={(e) => setOrderDiscountInput(e.target.value)}
                    onBlur={commitOrderDiscount}
                    className="w-14 px-1.5 py-0.5 text-center font-mono font-bold border border-slate-300 rounded bg-white"
                  />
                  <span className="text-slate-500 font-mono">%</span>
                </div>
              ) : (
                <span className="font-mono font-bold text-slate-800">{quotation.order_discount_percent}%</span>
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 space-y-2 text-xs border border-slate-200 rounded-md p-4 bg-white shadow-2xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrency(Number(quotation.subtotal))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Line &amp; Order Discounts:</span>
                  <span className="font-mono font-medium text-rose-700">-{formatCurrency(Number(quotation.discount_total))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span className="font-mono font-medium">{formatCurrency(Number(quotation.tax_total))}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base text-[#714B67]">{formatCurrency(Number(quotation.grand_total))}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600 space-x-6">
                {(
                  [
                    ['lines', 'Order Lines Overview', Layers],
                    ['governance', 'Governance', ShieldCheck],
                    ['notes', 'Internal Notes', FileText],
                    ['audit', `Audit Trail (${timeline.length})`, Clock],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                      activeTab === key ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              <div className="pt-4 text-xs">
                {activeTab === 'lines' && (
                  <div className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                    <p>
                      {quotation.items.length} line item{quotation.items.length === 1 ? '' : 's'} for{' '}
                      <strong>{customer?.name || 'this customer'}</strong>. Line and order-level discounts and
                      tax are computed by the database from the values above — never guessed on the client.
                    </p>
                  </div>
                )}

                {activeTab === 'governance' && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-relaxed">
                    {isEditable ? (
                      <p>
                        Discount governance runs automatically when you submit this quotation — it checks every
                        line and the order-level discount against the configured discount rules, and routes to
                        approval if any ceiling is exceeded.
                      </p>
                    ) : currentApproval ? (
                      <p>
                        Approval request <strong>{humanizeStatus(currentApproval.status)}</strong>
                        {currentApproval.reason ? `: ${currentApproval.reason}` : '.'}{' '}
                        <Link to={`/approvals/${quotation.id}`} className="text-[#714B67] font-semibold hover:underline">
                          View approval
                        </Link>
                      </p>
                    ) : (
                      <p>This quotation cleared discount governance without requiring approval.</p>
                    )}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">Session Notes (not saved to the server):</label>
                    <textarea
                      rows={3}
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Scratch space for this browsing session only — not persisted."
                      className="w-full p-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-hidden"
                    />
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="space-y-2">
                    {timeline.length === 0 ? (
                      <p className="text-slate-400 py-3">No activity recorded for this quotation yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {timeline.map((evt) => (
                          <div key={evt.id} className="py-2 flex items-start justify-between gap-3">
                            <div className="font-semibold text-slate-800">{humanizeStatus(evt.action)}</div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                              {formatExactDateTime(evt.created_at)}
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

          {/* Right Column: Governance & Intelligence */}
          <div className="lg:col-span-4 xl:col-span-3 p-5 bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#714B67]" /> Deal Health
              </span>
            </div>

            {/* Deal Health Score */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Risk Level</span>
                {dealHealth ? (
                  <RiskBadge level={riskLevelFromScore(dealHealth.risk_level)} size="md" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">Not yet scored</span>
                )}
              </div>
              {dealHealth && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Health Score</span>
                    <span className="font-mono font-bold text-slate-800">{Number(dealHealth.score).toFixed(0)} / 100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        riskLevelFromScore(dealHealth.risk_level) === 'HIGH'
                          ? 'bg-rose-500'
                          : riskLevelFromScore(dealHealth.risk_level) === 'MEDIUM'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, Number(dealHealth.score)))}%` }}
                    />
                  </div>
                </div>
              )}
              {!dealHealth && (
                <p className="text-[11px] text-slate-500">
                  Deal-health scoring runs automatically once this quotation has discount, negotiation, or
                  fulfillment activity to evaluate.
                </p>
              )}
            </div>

            {/* Margin */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
              {avgMarginPercent !== null ? (
                <MarginIndicator currentMarginPercent={avgMarginPercent} size="md" showDetails />
              ) : (
                <p className="text-[11px] text-slate-500">
                  No margin data yet — add a product with a recorded cost price to see margin here.
                </p>
              )}
            </div>

            {/* Recommended Add-ons */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Recommended Add-ons
                </span>
              </div>

              {recommendations.filter((r) => !dismissedRecommendations.has(r.recommended_product_id)).length === 0 ? (
                <div className="p-3 bg-white border border-slate-200 rounded text-center text-[11px] text-slate-400">
                  No pending cross-sell recommendations for current lines.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recommendations
                    .filter((r) => !dismissedRecommendations.has(r.recommended_product_id))
                    .slice(0, 4)
                    .map((rec) => (
                      <div key={rec.recommended_product_id} className="p-3 bg-purple-50/40 border border-purple-200 rounded-md text-xs space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-900">{rec.name}</div>
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {rec.recommendation_type === 'UPSELL' ? 'Upsell' : 'Cross-sell'}
                          </span>
                        </div>
                        {rec.reason && <p className="text-[11px] text-slate-600 leading-relaxed">{rec.reason}</p>}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-purple-100">
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedRecommendations((s) => new Set(s).add(rec.recommended_product_id))
                            }
                            className="text-[11px] text-slate-400 hover:text-slate-600 px-2 py-0.5"
                          >
                            Dismiss
                          </button>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => {
                                const product = productsById.get(rec.recommended_product_id);
                                if (product) handleAddProduct(product);
                              }}
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
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#714B67]" />
                <h3 className="font-bold text-slate-900 text-sm">Add Product to Quotation</h3>
              </div>
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

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
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {['All', ...new Set(categories.map((c) => c.name))].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedCategoryFilter === cat ? 'bg-[#714B67] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 text-xs">
              {catalogForbidden ? (
                <div className="py-8 text-center text-slate-400">Your role doesn't have catalog access.</div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No products matched your search.</div>
              ) : (
                filteredProducts.map((p) => {
                  const alreadyInQuote = quotation.items.some((i) => i.product_id === p.id);
                  const categoryName = p.category_id ? categoriesById.get(p.category_id) : undefined;
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          {categoryName && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-blue-50 text-blue-700">
                              {categoryName}
                            </span>
                          )}
                        </div>
                        {typeof p.description === 'string' && p.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-900">{formatCurrency(Number(p.base_price ?? p.price ?? 0))}</span>
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

            <div className="p-3 border-t border-slate-200 bg-[#F8F9FA] flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsProductModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
