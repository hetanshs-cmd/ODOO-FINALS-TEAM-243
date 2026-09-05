/**
 * DealFlow360 — Quotation detail (real backend)
 *
 * Previously this screen was wired to the in-memory mock `dealStore`, so
 * opening any real (API-backed) quotation row from the list showed
 * "Quotation Not Found". It now reads the real record via `useQuotation`
 * and only offers the operations the backend actually exposes:
 *   GET   /quotations/:id            (header + items + derived totals)
 *   PATCH /quotations/:id            (currency / valid-until while DRAFT)
 *   POST  /quotations/:id/items      (add a line while DRAFT)
 *   POST  /quotations/:id/submit     (DRAFT -> SUBMITTED + discount governance)
 *   GET   /quotations/:id/timeline   (audit-log activity feed)
 *
 * The rich mock-only concepts (per-line ceiling "over by", blended risk
 * score, order-level discount, internal notes) have no backing on the real
 * API and are intentionally dropped rather than faked. The AI Insights panel
 * is the one exception reintroduced here: it now calls the real
 * backend/src/modules/ai insight endpoint, grounded in this quotation's live
 * DB record (not the old mock-derived context), so it's no longer a faked
 * concept either.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Send,
  Save,
  AlertCircle,
  Package,
  Clock,
  Layers,
  RotateCw,
  X,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { StatusBadge, RiskBadge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useQuotation } from '../hooks/useQuotations';
import { useCustomers } from '../hooks/useCustomers';
import { useUsers } from '../hooks/useUsers';
import { productService, quotationService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiProduct, ApiQuotationItem, ApiTimelineEvent } from '../services/apiTypes';
import { RiskLevel } from '../types';
import { formatCurrency, formatRelativeTime, formatExactDateTime } from '../utils/formatters';
import { aiService, InsightType } from '../services/ai/aiService';
import { AIResult } from '../services/ai/types';
import { AIInsightPanel } from '../components/ai/AIInsightPanel';
import { AIDraftEditorModal } from '../components/ai/AIDraftEditorModal';

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function num(v: string | number | null | undefined): number {
  return typeof v === 'number' ? v : parseFloat(v ?? '0') || 0;
}

// productService.getAll() resolves to the paginated envelope despite its
// array-shaped type — unwrap defensively either way.
function unwrapProducts(res: unknown): ApiProduct[] {
  if (Array.isArray(res)) return res as ApiProduct[];
  if (res && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: ApiProduct[] }).items;
  }
  return [];
}

function approxRisk(subtotal: number, discount: number): { level: RiskLevel; pct: number } {
  const pct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const level: RiskLevel = pct > 15 ? 'HIGH' : pct > 7 ? 'MEDIUM' : 'LOW';
  return { level, pct };
}

interface NewItemForm {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

const EMPTY_ITEM: NewItemForm = {
  product_id: '',
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_percent: 0,
  billing_type: 'ONE_TIME',
};

export const QuotationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { quotation, loading, error, refetch } = useQuotation(id === 'new' ? undefined : id);
  const { customers } = useCustomers();
  const { users } = useUsers();

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [productsBlocked, setProductsBlocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    productService
      .getAll()
      .then((res) => !cancelled && setProducts(unwrapProducts(res as unknown)))
      .catch(() => !cancelled && setProductsBlocked(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [activeTab, setActiveTab] = useState<'lines' | 'timeline'>('lines');
  const [timeline, setTimeline] = useState<ApiTimelineEvent[]>([]);
  const [timelineLoaded, setTimelineLoaded] = useState(false);

  const loadTimeline = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      const rows = await quotationService.getTimeline(id);
      setTimeline(rows);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'timeline' && !timelineLoaded) void loadTimeline();
  }, [activeTab, timelineLoaded, loadTimeline]);

  // Header edit (DRAFT only)
  const [editingHeader, setEditingHeader] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  useEffect(() => {
    if (quotation) {
      setCurrency(quotation.currency);
      setValidUntil(quotation.valid_until ? quotation.valid_until.slice(0, 10) : '');
    }
  }, [quotation]);

  const [busy, setBusy] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState<NewItemForm>(EMPTY_ITEM);

  // AI Insights — real local-model-backed calls (backend/src/modules/ai),
  // grounded in this quotation's live DB record. No mock-data fallback here:
  // on failure this shows the honest "temporarily unavailable" state rather
  // than fabricating the mock-only fields (blended risk score, upsell
  // opportunities) this page intentionally stopped faking.
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiActiveType, setAiActiveType] = useState<InsightType | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const runAiInsight = async (type: InsightType) => {
    if (!quotation) return;
    setAiActiveType(type);
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiService.getInsight(type, quotation.id);
      setAiResult(result);
      if (type === 'draft_customer_message') setShowDraftModal(true);
    } catch (err) {
      setAiError(
        err instanceof ApiError
          ? err.message
          : 'The local AI model is unavailable. It may not be running.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const isDraft = quotation?.status === 'DRAFT';

  const handleSaveHeader = async () => {
    if (!quotation) return;
    setBusy(true);
    try {
      await quotationService.update(quotation.id, {
        currency,
        valid_until: validUntil || null,
      });
      toast.success('Quotation updated');
      setEditingHeader(false);
      await refetch();
    } catch (err) {
      toast.error('Update failed', err instanceof ApiError ? err.message : 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const handleProductPick = (productId: string) => {
    const p = productId ? productsById.get(productId) : undefined;
    const raw = p ? (p.price ?? p.base_price) : undefined;
    setItemForm((f) => ({
      ...f,
      product_id: productId,
      unit_price: raw !== undefined ? Number(raw) || 0 : 0,
      billing_type: (p?.['product_type'] as string) === 'RECURRING' ? 'RECURRING' : 'ONE_TIME',
    }));
  };

  const handleAddItem = async () => {
    if (!quotation) return;
    if (!itemForm.product_id) {
      toast.warning('Pick a product first');
      return;
    }
    setBusy(true);
    try {
      await quotationService.addItem(quotation.id, {
        product_id: itemForm.product_id,
        quantity: itemForm.quantity,
        unit_price: itemForm.unit_price,
        discount_percent: itemForm.discount_percent || undefined,
        tax_percent: itemForm.tax_percent || undefined,
        billing_type: itemForm.billing_type,
      });
      toast.success('Line item added');
      setShowAddItem(false);
      setItemForm(EMPTY_ITEM);
      await refetch();
    } catch (err) {
      toast.error('Could not add item', err instanceof ApiError ? err.message : 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!quotation) return;
    if (quotation.items.length === 0) {
      toast.warning('Add a line item', 'A quotation needs at least one line item before it can be confirmed.');
      return;
    }
    setBusy(true);
    try {
      await quotationService.submit(quotation.id);
      toast.success('Quotation confirmed', 'Submitted for discount governance review.');
      setTimelineLoaded(false);
      await refetch();
    } catch (err) {
      toast.warning('Submit incomplete', err instanceof ApiError ? err.message : 'Unknown error.');
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  // ── Loading / error / not-found ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-slate-100 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 bg-[#FEF2F2] text-[#DC2626] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FECACA]">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#111827] mb-1">Quotation not found</h2>
        <p className="text-xs text-[#6B7280] mb-5">
          {error?.message || `No quotation matches ${id}.`}
        </p>
        <Link
          to="/quotations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#714B67] text-white rounded-md font-medium text-xs hover:bg-[#5d3b53] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
        </Link>
      </div>
    );
  }

  const customerName = customersById.get(quotation.customer_id)?.name || 'Unknown Customer';
  const repName = usersById.get(quotation.sales_rep_id)?.name || 'Unassigned';
  const subtotal = num(quotation.subtotal);
  const discountTotal = num(quotation.discount_total);
  const { level: riskLevel, pct: discountPct } = approxRisk(subtotal, discountTotal);

  const productLabel = (item: ApiQuotationItem) =>
    item.description ||
    productsById.get(item.product_id)?.name ||
    `Product ${item.product_id.slice(0, 8)}`;

  return (
    <div className="space-y-3.5 pb-10">
      <PageHeader
        title={quotation.quotation_number}
        description={`${customerName} · ${humanizeStatus(quotation.status)}`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Quotations', href: '/quotations' },
          { label: quotation.quotation_number },
        ]}
        badge={<StatusBadge status={humanizeStatus(quotation.status)} size="md" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/quotations')}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCw className="w-3.5 h-3.5" />}
              onClick={() => refetch()}
            >
              Reload
            </Button>
            {isDraft && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="w-3.5 h-3.5" />}
                isLoading={busy}
                onClick={handleSubmit}
              >
                Confirm
              </Button>
            )}
          </div>
        }
      />

      {/* Header summary */}
      <div className="bg-white rounded-md border border-[#E5E7EB] shadow-2xs p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-xs">
            <Field label="Customer" value={customerName} />
            <Field label="Sales Rep" value={repName} />
            <Field label="Status" value={humanizeStatus(quotation.status)} />
            {editingHeader ? (
              <>
                <div>
                  <div className="text-[#6B7280] font-semibold mb-1">Currency</div>
                  <Select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    options={['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'].map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <div>
                  <div className="text-[#6B7280] font-semibold mb-1">Valid Until</div>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <Field label="Currency" value={quotation.currency} />
                <Field
                  label="Valid Until"
                  value={quotation.valid_until ? quotation.valid_until.slice(0, 10) : '—'}
                />
              </>
            )}
            <Field label="Created" value={formatExactDateTime(quotation.created_at)} />
            <Field label="Last Activity" value={formatRelativeTime(quotation.updated_at)} />
          </div>

          <div className="text-right">
            <span className="text-[11px] font-medium text-[#6B7280] block">Grand Total</span>
            <span className="text-2xl font-bold font-mono text-[#714B67]">
              {formatCurrency(num(quotation.grand_total))}
            </span>
            <div className="mt-1">
              <RiskBadge level={riskLevel} score={Math.round(discountPct)} size="sm" />
            </div>
          </div>
        </div>

        {isDraft && (
          <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center gap-2">
            {editingHeader ? (
              <>
                <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} isLoading={busy} onClick={handleSaveHeader}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingHeader(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingHeader(true)}>
                Edit currency / expiry
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="bg-white rounded-md border border-[#E5E7EB] shadow-2xs p-4">
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            <Row label="Discounts" value={`-${formatCurrency(discountTotal)}`} valueClass="text-[#B91C1C]" />
            <Row label="Tax" value={formatCurrency(num(quotation.tax_total))} />
            <div className="border-t border-[#E5E7EB] pt-1.5 flex justify-between font-bold text-sm text-[#111827]">
              <span>Grand Total</span>
              <span className="font-mono text-[#714B67]">{formatCurrency(num(quotation.grand_total))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-md border border-[#E5E7EB] shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#714B67]" /> AI Insights
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" isLoading={aiLoading && aiActiveType === 'summarize_quotation'} onClick={() => runAiInsight('summarize_quotation')}>
              Summarize
            </Button>
            <Button variant="outline" size="sm" isLoading={aiLoading && aiActiveType === 'explain_risk'} onClick={() => runAiInsight('explain_risk')}>
              Explain Risk
            </Button>
            <Button variant="outline" size="sm" isLoading={aiLoading && aiActiveType === 'suggest_improvements'} onClick={() => runAiInsight('suggest_improvements')}>
              Suggest Improvements
            </Button>
            <Button variant="outline" size="sm" isLoading={aiLoading && aiActiveType === 'draft_customer_message'} onClick={() => runAiInsight('draft_customer_message')}>
              Draft Follow-up
            </Button>
          </div>
        </div>
        {(aiResult || aiLoading || aiError) && (
          <AIInsightPanel
            result={aiResult}
            isLoading={aiLoading}
            loadingMessage="Consulting the local AI model…"
            errorMessage={aiError}
            onRetry={() => aiActiveType && runAiInsight(aiActiveType)}
            compact
          />
        )}
      </div>

      {showDraftModal && aiResult?.summary && (
        <AIDraftEditorModal
          isOpen={showDraftModal}
          onClose={() => setShowDraftModal(false)}
          title="Draft Follow-up Message"
          recipientLabel={customerName}
          initialBody={aiResult.summary}
          actionButtonLabel="Copy Draft"
          onApplyOrSend={(body) => {
            navigator.clipboard?.writeText(body).catch(() => undefined);
            toast.success('Draft copied', 'Paste it into your usual email/messaging tool to send.');
            setShowDraftModal(false);
          }}
        />
      )}

      {/* Tabs */}
      <div className="bg-white rounded-md border border-[#E5E7EB] shadow-2xs">
        <div className="flex border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280] px-4">
          <TabButton active={activeTab === 'lines'} onClick={() => setActiveTab('lines')} icon={<Layers className="w-3.5 h-3.5" />}>
            Line Items ({quotation.items.length})
          </TabButton>
          <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={<Clock className="w-3.5 h-3.5" />}>
            Activity
          </TabButton>
        </div>

        {activeTab === 'lines' && (
          <div className="p-4 space-y-3">
            {isDraft && (
              <div className="flex justify-end">
                {productsBlocked ? (
                  <span className="text-[11px] text-[#9CA3AF]">
                    Product catalog unavailable for your role — line items cannot be added here.
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setShowAddItem(true)}
                  >
                    Add Line
                  </Button>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-[#E5E7EB] rounded-md">
              <table className="w-full text-left border-collapse min-w-[640px] text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[11px] text-[#4B5563] uppercase tracking-wider">
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold text-center w-16">Qty</th>
                    <th className="px-3 py-2 font-semibold text-right w-28">Unit Price</th>
                    <th className="px-3 py-2 font-semibold text-center w-20">Disc %</th>
                    <th className="px-3 py-2 font-semibold text-center w-20">Tax %</th>
                    <th className="px-3 py-2 font-semibold text-center w-24">Billing</th>
                    <th className="px-3 py-2 font-semibold text-right w-28">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {quotation.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#9CA3AF]">
                        <Package className="w-7 h-7 mx-auto text-[#D1D5DB] mb-2" />
                        <p className="text-xs font-semibold text-[#374151]">No line items yet</p>
                        {isDraft && !productsBlocked && (
                          <p className="text-[11px] mt-0.5">Use “Add Line” to add products.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    quotation.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF5F8]/60">
                        <td className="px-3 py-2.5 font-medium text-[#111827]">{productLabel(item)}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{num(item.quantity)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(num(item.unit_price))}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{num(item.discount_percent)}%</td>
                        <td className="px-3 py-2.5 text-center font-mono">{num(item.tax_percent)}%</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.billing_type === 'RECURRING' ? 'Recurring' : 'One-time'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#111827]">
                          {formatCurrency(num(item.line_total))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isDraft && (
              <p className="text-[11px] text-[#9CA3AF]">
                This quotation is <strong>{humanizeStatus(quotation.status)}</strong> — line items are locked.
              </p>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-4">
            {!timelineLoaded ? (
              <p className="text-xs text-[#9CA3AF] py-4">Loading activity…</p>
            ) : timeline.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] py-4">No activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {timeline.map((evt) => {
                  const action = String(evt['action'] ?? evt.event_type ?? 'EVENT');
                  const actorId = (evt['user_id'] ?? evt.actor_user_id) as string | undefined;
                  return (
                    <div key={evt.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[#374151]">{humanizeStatus(action)}</div>
                        <div className="text-[10px] text-[#9CA3AF]">
                          {actorId ? usersById.get(actorId)?.name || 'System' : 'System'}
                        </div>
                      </div>
                      <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap font-mono">
                        {formatExactDateTime(evt.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-item modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-3.5 border-b border-[#E5E7EB] bg-[#F8F9FA] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827]">Add Line Item</h3>
              <button type="button" onClick={() => setShowAddItem(false)} className="text-[#9CA3AF] hover:text-[#374151] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Select
                label="Product"
                required
                value={itemForm.product_id}
                onChange={(e) => handleProductPick(e.target.value)}
                options={[
                  { value: '', label: 'Select a product…' },
                  ...products.map((p) => ({ value: p.id, label: p.sku ? `${p.name} (${p.sku})` : p.name })),
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                />
                <Input
                  label="Unit Price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm.unit_price}
                  onChange={(e) => setItemForm((f) => ({ ...f, unit_price: Number(e.target.value) || 0 }))}
                />
                <Input
                  label="Discount %"
                  type="number"
                  min={0}
                  max={100}
                  value={itemForm.discount_percent}
                  onChange={(e) => setItemForm((f) => ({ ...f, discount_percent: Number(e.target.value) || 0 }))}
                />
                <Input
                  label="Tax %"
                  type="number"
                  min={0}
                  max={100}
                  value={itemForm.tax_percent}
                  onChange={(e) => setItemForm((f) => ({ ...f, tax_percent: Number(e.target.value) || 0 }))}
                />
              </div>
              <Select
                label="Billing"
                value={itemForm.billing_type}
                onChange={(e) => setItemForm((f) => ({ ...f, billing_type: e.target.value as NewItemForm['billing_type'] }))}
                options={[
                  { value: 'ONE_TIME', label: 'One-time' },
                  { value: 'RECURRING', label: 'Recurring' },
                ]}
              />
            </div>
            <div className="p-3.5 border-t border-[#E5E7EB] bg-[#F8F9FA] flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddItem(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={busy} onClick={handleAddItem}>
                Add Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[#6B7280] font-semibold">{label}</div>
    <div className="text-[#111827] mt-0.5">{value}</div>
  </div>
);

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = '' }) => (
  <div className="flex justify-between text-[#4B5563]">
    <span>{label}</span>
    <span className={`font-mono font-medium ${valueClass}`}>{value}</span>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-2.5 px-3 -mb-px border-b-2 flex items-center gap-1.5 transition-colors ${
      active ? 'border-[#714B67] text-[#714B67]' : 'border-transparent hover:text-[#111827]'
    }`}
  >
    {icon}
    {children}
  </button>
);
