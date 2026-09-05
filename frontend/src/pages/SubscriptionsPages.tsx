/**
 * DealFlow360 — Subscriptions & Recurring Contracts (real backend)
 *
 * This page previously had zero real backend support (list/detail were
 * mock-store stubs) — full migration to the now-live subscriptions CRUD
 * (GET/PATCH/cancel) and credit-notes read endpoints. Several rich
 * mock-computed sections (hybrid physical/recurring billing breakdown,
 * mid-cycle proration audit trail, a per-subscription billing schedule
 * table) depended on domain engines wired to the mock Quotation/
 * Subscription shapes with no real-backend equivalent exposed yet, and are
 * simplified out (with a TODO) rather than fabricated.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  Calendar,
  DollarSign,
  ArrowLeft,
  FileText,
  AlertTriangle,
  Layers,
  TrendingUp,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useSubscriptions, useSubscription } from '../hooks/useSubscriptions';
import { useCreditNotes } from '../hooks/useCreditNotes';
import { subscriptionService, creditNoteService, billingService, adminService, isForbiddenError } from '../services';
import { ApiSubscription, ApiCreditNote, ApiInvoice } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';

export const SubscriptionsListPage: React.FC = () => {
  const { subscriptions, loading, error } = useSubscriptions();
  const { creditNotes, loading: creditNotesLoading, refetch: refetchCreditNotes } = useCreditNotes();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'subscriptions' | 'creditNotes'>('subscriptions');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApiSubscription['status']>('ALL');

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE');
  const totalMRR = activeSubs.reduce((sum, s) => sum + Number(s.current_price), 0);
  const totalARR = totalMRR * 12;
  const totalCreditIssued = creditNotes.reduce((sum, c) => sum + Number(c.amount), 0);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        !searchTerm.trim() ||
        sub.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.plan_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, searchTerm, statusFilter]);

  const handleMarkApplied = async (creditNoteId: string) => {
    try {
      await creditNoteService.updateStatus(creditNoteId, 'APPLIED');
      refetchCreditNotes();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update credit note status', err);
    }
  };

  const columns: Column<ApiSubscription>[] = [
    {
      key: 'id',
      header: 'Subscription ID',
      render: (s) => (
        <div>
          <span className="font-mono font-bold text-blue-900">{s.id}</span>
          {s.quotation_id && <div className="font-mono text-[10px] text-slate-500">Ref: {s.quotation_id}</div>}
        </div>
      ),
    },
    {
      key: 'customer_id',
      header: 'Customer',
      // TODO: resolve customer display name once a customers directory hook lands.
      render: (s) => <span className="font-mono font-semibold text-slate-900">{s.customer_id}</span>,
    },
    {
      key: 'plan_id',
      header: 'Plan',
      render: (s) => <span className="text-xs font-mono text-slate-800">{s.plan_id}</span>,
    },
    {
      key: 'current_price',
      header: 'Recurring Amount',
      align: 'right',
      render: (s) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          ₹{Number(s.current_price).toLocaleString()}/mo
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Contract Status',
      render: (s) => <StatusBadge status={s.status} size="sm" />,
    },
    {
      key: 'next_billing_date',
      header: 'Next Bill Date',
      render: (s) => (
        <div className="font-mono text-xs text-slate-700">
          <div>{s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : '—'}</div>
          <div className="text-[10px] text-slate-400">Start: {new Date(s.start_date).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      render: (s) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/subscriptions/${s.id}`);
          }}
          className="text-xs font-semibold text-blue-800 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2.5 py-1 transition-colors"
        >
          Manage
        </button>
      ),
    },
  ];

  const creditNoteColumns: Column<ApiCreditNote>[] = [
    { key: 'id', header: 'Credit Note #', render: (c) => <span className="font-mono font-bold text-rose-900">{c.id}</span> },
    {
      key: 'customer_id',
      header: 'Customer',
      render: (c) => <span className="font-mono font-semibold text-slate-900">{c.customer_id}</span>,
    },
    {
      key: 'subscription_id',
      header: 'Subscription Ref',
      render: (c) => <span className="font-mono text-xs text-blue-900">{c.subscription_id || '—'}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (c) => <span className="font-mono text-xs text-slate-600">{new Date(c.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'amount',
      header: 'Credit Amount',
      align: 'right',
      render: (c) => <span className="font-mono font-bold text-rose-700 text-xs">₹{Number(c.amount).toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
            c.status === 'APPLIED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : c.status === 'PENDING'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}
        >
          {c.status}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Justification',
      render: (c) => <span className="text-xs text-slate-600 italic">{c.reason || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      render: (c) => (
        <div>
          {c.status !== 'APPLIED' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkApplied(c.id);
              }}
              className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-2 py-1 transition-colors"
            >
              Mark Applied
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions & Recurring Contracts"
        description="Live subscriptions register and credit-notes ledger, backed by the real subscriptions/credit-notes API."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Subscriptions' }]}
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
          Failed to load subscriptions: {error.message}
        </div>
      )}

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
            Active Subscriptions
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {activeSubs.length}
            <span className="text-xs font-normal text-slate-500 ml-2">of {subscriptions.length} total</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            Monthly Recurring Revenue (MRR)
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900">₹{Math.round(totalMRR).toLocaleString()}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-800" />
            Annual Recurring Run-Rate (ARR)
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950">₹{Math.round(totalARR).toLocaleString()}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-rose-700" />
            Credit Notes Issued
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900">₹{totalCreditIssued.toFixed(2)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{creditNotes.length} credit notes recorded</div>
        </div>
      </div>

      {/* Tabs — the mock's third "Proration Audit Trail" tab is dropped: no
          backend endpoint exposes proration events yet. */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'subscriptions' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Subscriptions Register ({subscriptions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('creditNotes')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'creditNotes' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Credit Notes Ledger ({creditNotes.length})
        </button>
      </div>

      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
            <input
              type="text"
              placeholder="Search by subscription, customer, or plan ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs border border-slate-300 rounded px-3 py-1.5 w-full sm:w-80 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-medium mr-1">Status:</span>
              {(['ALL', 'ACTIVE', 'MODIFIED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    statusFilter === st ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading subscriptions…</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredSubscriptions}
              keyExtractor={(s) => s.id}
              onRowClick={(s) => navigate(`/subscriptions/${s.id}`)}
            />
          )}
        </div>
      )}

      {activeTab === 'creditNotes' && (
        <div className="space-y-4">
          {creditNotesLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading credit notes…</div>
          ) : (
            <DataTable columns={creditNoteColumns} data={creditNotes} keyExtractor={(c) => c.id} />
          )}
        </div>
      )}
    </div>
  );
};

export const SubscriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { subscription: sub, loading, error, refetch } = useSubscription(id);

  const [creditNotes, setCreditNotes] = useState<ApiCreditNote[]>([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);
  const [relatedInvoices, setRelatedInvoices] = useState<ApiInvoice[]>([]);
  const [plans, setPlans] = useState<{ id: string; name?: string }[]>([]);

  React.useEffect(() => {
    if (!sub) return;
    setCreditNotesLoading(true);
    creditNoteService
      .getAll({ subscription_id: sub.id })
      .then(setCreditNotes)
      .catch(() => setCreditNotes([]))
      .finally(() => setCreditNotesLoading(false));

    if (sub.quotation_id) {
      billingService
        .getInvoices({ quotation_id: sub.quotation_id })
        .then(setRelatedInvoices)
        .catch(() => setRelatedInvoices([]));
    } else {
      setRelatedInvoices([]);
    }
  }, [sub]);

  React.useEffect(() => {
    adminService.subscriptionPlans
      .list()
      .then((p: any[]) => setPlans(p))
      .catch((err) => {
        if (!isForbiddenError(err)) {
          // eslint-disable-next-line no-console
          console.error('Failed to load subscription plans', err);
        }
        setPlans([]);
      });
  }, []);

  const [activeTab, setActiveTab] = useState<'overview' | 'creditNotes'>('overview');
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [modifyPlanId, setModifyPlanId] = useState('');
  const [modifyPrice, setModifyPrice] = useState<number>(0);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading subscription…</div>;
  }

  if (error || !sub) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-bold text-slate-800">Subscription Not Found</h3>
        <p className="text-xs text-slate-500 mt-2">The requested subscription ID could not be loaded.</p>
        <Link
          to="/subscriptions"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 border border-slate-300 rounded px-3 py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Register
        </Link>
      </div>
    );
  }

  const handleModifyConfirm = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      const updates: Partial<ApiSubscription> = {};
      if (modifyPlanId) updates.plan_id = modifyPlanId;
      if (modifyPrice > 0) updates.current_price = String(modifyPrice);
      await subscriptionService.modify(sub.id, updates);
      setIsModifyModalOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to modify subscription.');
    } finally {
      setIsActing(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await subscriptionService.cancel(sub.id, { reason: cancelReason || undefined });
      setIsCancelModalOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to cancel subscription.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Subscription: ${sub.id}`}
        description={`Recurring contract for customer ${sub.customer_id}. TODO: resolve customer display name once a customers directory hook lands.`}
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Subscriptions', href: '/subscriptions' }, { label: sub.id }]}
        badge={<StatusBadge status={sub.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/subscriptions"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 bg-white shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Register
            </Link>

            {sub.status === 'ACTIVE' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModifyPlanId(sub.plan_id);
                    setModifyPrice(Number(sub.current_price));
                    setActionError(null);
                    setIsModifyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded px-3 py-1.5 shadow-2xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Modify Plan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelReason('');
                    setActionError(null);
                    setIsCancelModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded px-3 py-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel Subscription
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Contract Metadata Overview Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Customer</span>
            <div className="font-mono font-bold text-slate-900 text-sm">{sub.customer_id}</div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Origin Quotation</span>
            {sub.quotation_id ? (
              <Link to={`/quotations/${sub.quotation_id}`} className="font-mono font-bold text-blue-900 text-sm hover:underline flex items-center gap-1">
                {sub.quotation_id} <ExternalLink className="w-3 h-3 text-slate-400" />
              </Link>
            ) : (
              <span className="font-mono text-slate-400">—</span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Active Plan & Rate</span>
            <div className="font-mono font-bold text-slate-900 text-sm">{sub.plan_id}</div>
            <div className="text-blue-900 font-mono font-bold text-xs mt-0.5">₹{Number(sub.current_price).toLocaleString()}/mo</div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Billing Timeline</span>
            <div className="font-mono text-slate-800 text-xs">
              Next Bill: <strong>{sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString() : '—'}</strong>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">Start: {new Date(sub.start_date).toLocaleDateString()}</div>
          </div>
        </div>

        {sub.status === 'CANCELLED' && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Subscription Cancelled</span>
              {sub.end_date && <span className="text-[10px] font-mono text-rose-700 block mt-0.5">Ended: {new Date(sub.end_date).toLocaleDateString()}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Tabs — the mock's "Hybrid Billing Breakdown", "Billing Schedule",
          and "Proration Amendments" tabs relied on domain engines coupled to
          the mock Quotation/Subscription shapes with no real-backend
          equivalent exposed yet (no proration-event or billing-schedule
          endpoint documented). Replaced with a simplified overview
          (this subscription's real fields + any invoices sharing its
          origin quotation) and the real credit-notes ledger. */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'overview' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Overview & Related Invoices
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('creditNotes')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'creditNotes' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Credit Notes Ledger ({creditNotes.length})
        </button>
      </div>

      {activeTab === 'overview' && (
        <Card title="Related Invoices" subtitle="Invoices sharing this subscription's origin quotation (GET /invoices?quotation_id=...)." padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {relatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <Link to={`/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</Link>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={inv.status} size="sm" /></td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{Number(inv.total).toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {relatedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 italic">
                      No invoices found for this subscription&apos;s origin quotation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'creditNotes' && (
        <Card title="Customer Credit Notes" subtitle="Backed by GET /credit-notes?subscription_id=... (auto-created by the backend on downgrade/cancel)." padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Credit Note #</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4 text-right">Credit Amount</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {creditNotesLoading ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-500">Loading…</td></tr>
                ) : creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 italic">No credit notes issued for this subscription.</td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-rose-900">{cn.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{new Date(cn.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 text-sm">₹{Number(cn.amount).toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            cn.status === 'APPLIED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {cn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 italic">{cn.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modify Modal */}
      <Modal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title={`Modify Subscription — ${sub.id}`}
        description="Calls PATCH /subscriptions/:id."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModifyModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleModifyConfirm} disabled={isActing}>Save Changes</Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {actionError && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Plan</label>
            {plans.length > 0 ? (
              <select
                value={modifyPlanId}
                onChange={(e) => setModifyPlanId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-slate-900"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={modifyPlanId}
                onChange={(e) => setModifyPlanId(e.target.value)}
                placeholder="plan id"
                className="w-full p-2 border border-slate-300 rounded text-slate-900 font-mono"
              />
            )}
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Recurring Price</label>
            <input
              type="number"
              value={modifyPrice}
              onChange={(e) => setModifyPrice(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded text-slate-900"
              min={0}
              step="0.01"
            />
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Cancel Subscription — ${sub.id}`}
        description="Calls POST /subscriptions/:id/cancel. A credit note is created automatically by the backend if a refund applies."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
            <Button variant="danger" size="sm" onClick={handleCancelConfirm} disabled={isActing}>Confirm Cancellation</Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {actionError && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cancellation Reason</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="e.g., Customer downgraded to a competing product."
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
