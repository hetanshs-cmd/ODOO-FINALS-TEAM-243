import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  Calendar,
  DollarSign,
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  TrendingUp,
  Tag,
  ExternalLink,
  ChevronRight,
  Plus,
  Sliders,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useDealStore } from '../hooks/useDealStore';
import { Subscription, CreditNote, ProrationEvent } from '../types';
import { HybridBillingBreakdown } from '../components/domain/HybridBillingBreakdown';
import { ProrationModal } from '../components/domain/ProrationModal';
import { CancellationModal } from '../components/domain/CancellationModal';
import { BillingScheduleTable } from '../components/domain/BillingScheduleTable';

export const SubscriptionsListPage: React.FC = () => {
  const { subscriptions, creditNotes, prorationEvents, updateCreditNoteStatus } = useDealStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'subscriptions' | 'creditNotes' | 'prorationAudit'>('subscriptions');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Paused' | 'Cancelled'>('ALL');
  const [cycleFilter, setCycleFilter] = useState<'ALL' | 'monthly' | 'yearly'>('ALL');

  // KPI calculations
  const activeSubs = subscriptions.filter((s) => s.status === 'Active');
  const totalMRR = activeSubs.reduce((sum, s) => {
    const monthlyRate = s.cycle === 'yearly' ? (s.amount ?? 0) / 12 : (s.amount ?? 0);
    return sum + monthlyRate;
  }, 0);
  const totalARR = totalMRR * 12;
  const totalCreditIssued = creditNotes.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  // Filtered subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        (sub.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.planName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;
      const matchesCycle = cycleFilter === 'ALL' || sub.cycle === cycleFilter;
      return matchesSearch && matchesStatus && matchesCycle;
    });
  }, [subscriptions, searchTerm, statusFilter, cycleFilter]);

  const columns: Column<Subscription>[] = [
    {
      key: 'code',
      header: 'Subscription ID',
      render: (s) => (
        <div>
          <span className="font-mono font-bold text-blue-900">{s.code}</span>
          {s.quotationCode && (
            <div className="font-mono text-[10px] text-slate-500">Ref: {s.quotationCode}</div>
          )}
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (s) => (
        <div>
          <span className="font-semibold text-slate-900 block">{s.customerName}</span>
          {s.customerTier && (
            <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              {s.customerTier} Tier
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'planName',
      header: 'Plan / Subscription Tier',
      render: (s) => (
        <div>
          <span className="text-xs font-medium text-slate-800 block">{s.planName}</span>
          <span className="text-[11px] text-slate-500 font-mono">{s.quantity} unit(s) @ ${s.unitRecurringPrice}/mo</span>
        </div>
      ),
    },
    {
      key: 'cycle',
      header: 'Billing Cadence',
      render: (s) => (
        <span className="font-semibold uppercase tracking-wider text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
          {s.cycle || 'Monthly'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Recurring Amount',
      align: 'right',
      render: (s) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-900 text-xs">
            ${(s.amount ?? 0).toLocaleString()}/{s.cycle === 'yearly' ? 'yr' : 'mo'}
          </span>
          <div className="text-[10px] text-blue-800 font-mono font-semibold">
            MRR: ${(s.cycle === 'yearly' ? (s.amount ?? 0) / 12 : (s.amount ?? 0)).toFixed(0)}/mo
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Contract Status',
      render: (s) => <StatusBadge status={s.status} size="sm" />,
    },
    {
      key: 'nextBillDate',
      header: 'Next Bill Date',
      render: (s) => (
        <div className="font-mono text-xs text-slate-700">
          <div>{s.nextBillDate}</div>
          <div className="text-[10px] text-slate-400">Start: {s.startDate}</div>
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

  const creditNoteColumns: Column<CreditNote>[] = [
    {
      key: 'code',
      header: 'Credit Note #',
      render: (c) => <span className="font-mono font-bold text-rose-900">{c.code}</span>,
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (c) => <span className="font-semibold text-slate-900">{c.customerName}</span>,
    },
    {
      key: 'subscriptionCode',
      header: 'Subscription Ref',
      render: (c) => (
        <span className="font-mono text-xs text-blue-900">
          {c.subscriptionCode || c.subscriptionId}
        </span>
      ),
    },
    {
      key: 'effectiveDate',
      header: 'Effective Date',
      render: (c) => <span className="font-mono text-xs text-slate-600">{c.effectiveDate}</span>,
    },
    {
      key: 'amount',
      header: 'Credit Amount',
      align: 'right',
      render: (c) => (
        <span className="font-mono font-bold text-rose-700 text-xs">
          ${c.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
            c.status === 'Applied'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : c.status === 'Draft'
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
      header: 'Justification & Reason',
      render: (c) => <span className="text-xs text-slate-600 italic">{c.reason}</span>,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      render: (c) => (
        <div>
          {c.status !== 'Applied' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateCreditNoteStatus(c.id, 'Applied');
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
        description="Hybrid contract billing ledger, automated monthly recurring schedules, and mid-cycle proration."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Subscriptions' }]}
      />

      {/* Enterprise KPI Metrics Bar */}
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
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Deterministic live accounts
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            Monthly Recurring Revenue (MRR)
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900">
            ${Math.round(totalMRR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Normalized monthly volume
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-800" />
            Annual Recurring Run-Rate (ARR)
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950">
            ${Math.round(totalARR).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Annualized contract value
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-rose-700" />
            Credit Notes Issued
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900">
            ${totalCreditIssued.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {creditNotes.length} credit notes recorded
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'subscriptions'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Subscriptions Register ({subscriptions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('creditNotes')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'creditNotes'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Credit Notes Ledger ({creditNotes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('prorationAudit')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'prorationAudit'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Proration Audit Trail ({prorationEvents.length})
        </button>
      </div>

      {/* Subscriptions Tab View */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
            <input
              type="text"
              placeholder="Search by subscription code, customer, or plan name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs border border-slate-300 rounded px-3 py-1.5 w-full sm:w-80 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 font-medium mr-1">Status:</span>
                {(['ALL', 'Active', 'Paused', 'Cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      statusFilter === st
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 font-medium mr-1">Cadence:</span>
                {(['ALL', 'monthly', 'yearly'] as const).map((cy) => (
                  <button
                    key={cy}
                    type="button"
                    onClick={() => setCycleFilter(cy)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase transition-colors ${
                      cycleFilter === cy
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cy}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredSubscriptions}
            keyExtractor={(s) => s.id}
            onRowClick={(s) => navigate(`/subscriptions/${s.id}`)}
          />
        </div>
      )}

      {/* Credit Notes Ledger Tab View */}
      {activeTab === 'creditNotes' && (
        <div className="space-y-4">
          <DataTable
            columns={creditNoteColumns}
            data={creditNotes}
            keyExtractor={(c) => c.id}
          />
        </div>
      )}

      {/* Proration Audit Trail Tab View */}
      {activeTab === 'prorationAudit' && (
        <Card title="Proration Event Audit Trail" padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Event ID</th>
                  <th className="py-2.5 px-4">Subscription</th>
                  <th className="py-2.5 px-4">Effective Date</th>
                  <th className="py-2.5 px-4">Cycle Window</th>
                  <th className="py-2.5 px-4">Previous Plan</th>
                  <th className="py-2.5 px-4">New Plan</th>
                  <th className="py-2.5 px-4 text-right">Credit</th>
                  <th className="py-2.5 px-4 text-right">Prorated Charge</th>
                  <th className="py-2.5 px-4 text-right">Net Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prorationEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{evt.id}</td>
                    <td className="py-3 px-4 font-mono text-blue-900 font-semibold">
                      {evt.subscriptionId}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{evt.effectiveDate}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {evt.remainingDays}/{evt.totalDaysInPeriod} days remaining
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{evt.previousPlanName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {evt.previousQuantity}x (${evt.previousAmount}/mo)
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{evt.newPlanName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {evt.newQuantity}x (${evt.newAmount}/mo)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                      -${evt.creditAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 font-semibold">
                      +${evt.proratedCharge.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          evt.netAdjustment >= 0 ? 'text-blue-950' : 'text-emerald-700'
                        }`}
                      >
                        {evt.netAdjustment >= 0 ? '+' : ''}${evt.netAdjustment.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {prorationEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-500 italic">
                      No mid-cycle proration events logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export const SubscriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    subscriptions,
    subscriptionPlans,
    quotations,
    invoices,
    activeFulfillmentSplits,
    currentUser,
    modifySubscription,
    cancelSubscription,
    recordPayment,
    creditNotes,
    prorationEvents,
  } = useDealStore();

  const [activeTab, setActiveTab] = useState<
    'hybridBreakdown' | 'billingSchedule' | 'prorationHistory' | 'creditNotes'
  >('hybridBreakdown');

  const [isProrationModalOpen, setIsProrationModalOpen] = useState(false);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);

  // Target Subscription Lookup
  const sub = useMemo(() => {
    return subscriptions.find((s) => s.id === id || s.code === id) || null;
  }, [subscriptions, id]);

  // Associated Parent Quotation Lookup
  const quotation = useMemo(() => {
    if (!sub) return undefined;
    return quotations.find(
      (q) =>
        q.id === sub.quotationId ||
        q.code === sub.quotationId ||
        (sub.quotationCode && (q.id === sub.quotationCode || q.code === sub.quotationCode))
    );
  }, [quotations, sub]);

  // Active Fulfillment Split
  const fulfillmentSplit = useMemo(() => {
    if (!quotation) return undefined;
    return activeFulfillmentSplits[quotation.id];
  }, [activeFulfillmentSplits, quotation]);

  // Associated Credit Notes
  const subCreditNotes = useMemo(() => {
    if (!sub) return [];
    return creditNotes.filter(
      (c) => c.subscriptionId === sub.id || c.subscriptionCode === sub.code || c.customerId === sub.customerId
    );
  }, [creditNotes, sub]);

  // Associated Proration Events
  const subProrationEvents = useMemo(() => {
    if (!sub) return [];
    return prorationEvents.filter((p) => p.subscriptionId === sub.id);
  }, [prorationEvents, sub]);

  if (!sub) {
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

  const handleProrationConfirm = (updates: {
    newPlanId: string;
    newQuantity: number;
    effectiveDate: string;
    prorationRule: 'daily_linear' | 'full_month';
    reason: string;
  }) => {
    modifySubscription(sub.id, updates);
  };

  const handleCancellationConfirm = (options: {
    reason: string;
    effectiveDate: string;
    refundPolicy: 'prorated_credit' | 'full_credit' | 'no_refund';
  }) => {
    cancelSubscription(sub.id, options);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={`Subscription: ${sub.code}`}
        description={`Hybrid billing ledger and proration engine for ${sub.customerName}.`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Subscriptions', href: '/subscriptions' },
          { label: sub.code },
        ]}
        badge={<StatusBadge status={sub.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/subscriptions"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 bg-white shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Register
            </Link>

            {sub.status === 'Active' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsProrationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded px-3 py-1.5 shadow-2xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Modify / Prorate Plan
                </button>

                <button
                  type="button"
                  onClick={() => setIsCancellationModalOpen(true)}
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Customer Entity
            </span>
            <div className="font-bold text-slate-900 text-sm">{sub.customerName}</div>
            <div className="text-slate-500 font-mono text-[11px] mt-0.5">ID: {sub.customerId}</div>
            {sub.customerTier && (
              <span className="inline-block mt-1 text-[10px] uppercase font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                {sub.customerTier} Pricing Tier
              </span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Origin Commercial Deal
            </span>
            {quotation ? (
              <Link
                to={`/quotations/${quotation.id}`}
                className="font-mono font-bold text-blue-900 text-sm hover:underline flex items-center gap-1"
              >
                {quotation.code} <ExternalLink className="w-3 h-3 text-slate-400" />
              </Link>
            ) : (
              <span className="font-mono text-slate-700">{sub.quotationId}</span>
            )}
            <div className="text-slate-500 text-[11px] mt-0.5">
              Stage: {quotation ? quotation.stage : 'Approved'}
            </div>
            <div className="text-emerald-700 font-medium text-[11px] mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Hybrid Contract Signed
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Active Plan & Rate
            </span>
            <div className="font-bold text-slate-900 text-sm">{sub.planName}</div>
            <div className="text-blue-900 font-mono font-bold text-xs mt-0.5">
              ${sub.amount.toLocaleString()}/{sub.cycle === 'yearly' ? 'yr' : 'mo'}
            </div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              {sub.quantity} seat(s) • ${sub.unitRecurringPrice}/mo each
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Billing Timeline
            </span>
            <div className="font-mono text-slate-800 text-xs">
              Next Bill: <strong>{sub.nextBillDate}</strong>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
              Contract Start: {sub.startDate}
            </div>
            {sub.lastProratedAt && (
              <div className="font-mono text-[10px] text-blue-700 mt-1">
                Last Prorated: {sub.lastProratedAt.split('T')[0]}
              </div>
            )}
          </div>
        </div>

        {sub.status === 'Cancelled' && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Subscription Cancelled</span>
              <p className="mt-0.5 text-rose-800">
                Reason: {sub.cancellationReason || 'Contract terminated mid-cycle.'}
              </p>
              {sub.cancelledAt && (
                <span className="text-[10px] font-mono text-rose-700 block mt-0.5">
                  Cancellation Timestamp: {sub.cancelledAt}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('hybridBreakdown')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'hybridBreakdown'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Hybrid Contract Breakdown (Physical vs Recurring)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billingSchedule')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'billingSchedule'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Billing Schedule & Invoices
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('prorationHistory')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'prorationHistory'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Proration Amendments ({subProrationEvents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('creditNotes')}
          className={`pb-2.5 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'creditNotes'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Credit Notes Ledger ({subCreditNotes.length})
        </button>
      </div>

      {/* Tab 1: Hybrid Contract Breakdown */}
      {activeTab === 'hybridBreakdown' && (
        <div className="space-y-4">
          {quotation ? (
            <HybridBillingBreakdown
              quotation={quotation}
              fulfillmentSplit={fulfillmentSplit}
            />
          ) : (
            <Card title="Source Quotation Not Linked" padding="lg">
              <p className="text-xs text-slate-600">
                The original quotation for this subscription is not currently available in store.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Billing Schedule & Invoices */}
      {activeTab === 'billingSchedule' && (
        <BillingScheduleTable
          subscription={sub}
          invoices={invoices}
          onRecordPayment={recordPayment}
        />
      )}

      {/* Tab 3: Proration Amendments */}
      {activeTab === 'prorationHistory' && (
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-slate-900">
                Mid-Cycle Proration Events & Contract Amendments
              </span>
              <span className="text-xs font-mono text-slate-500">
                {subProrationEvents.length} event(s) recorded
              </span>
            </div>
          }
          padding="none"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Event Code</th>
                  <th className="py-2.5 px-4">Effective Date</th>
                  <th className="py-2.5 px-4">Cycle Remaining</th>
                  <th className="py-2.5 px-4">Previous Plan & Rate</th>
                  <th className="py-2.5 px-4">New Plan & Rate</th>
                  <th className="py-2.5 px-4 text-right">Credit</th>
                  <th className="py-2.5 px-4 text-right">Prorated Charge</th>
                  <th className="py-2.5 px-4 text-right">Net Adjustment</th>
                  <th className="py-2.5 px-4">Reason / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subProrationEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{evt.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{evt.effectiveDate}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {evt.remainingDays}/{evt.totalDaysInPeriod} days
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{evt.previousPlanName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {evt.previousQuantity}x (${evt.previousAmount}/mo)
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{evt.newPlanName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {evt.newQuantity}x (${evt.newAmount}/mo)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                      -${evt.creditAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 font-semibold">
                      +${evt.proratedCharge.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                      {evt.netAdjustment >= 0 ? '+' : ''}${evt.netAdjustment.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] italic">
                      {evt.description}
                    </td>
                  </tr>
                ))}
                {subProrationEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-500 italic">
                      No mid-cycle plan proration events recorded for this subscription yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Credit Notes Ledger */}
      {activeTab === 'creditNotes' && (
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-slate-900">
                Customer Credit Notes & Cancellation Settlement Ledger
              </span>
              <span className="text-xs font-mono text-slate-500">
                {subCreditNotes.length} credit note(s)
              </span>
            </div>
          }
          padding="none"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Credit Note #</th>
                  <th className="py-2.5 px-4">Effective Date</th>
                  <th className="py-2.5 px-4 text-right">Credit Amount</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subCreditNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-rose-900">{cn.code}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{cn.effectiveDate}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 text-sm">
                      ${cn.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          cn.status === 'Applied'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {cn.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 italic">{cn.reason}</td>
                  </tr>
                ))}
                {subCreditNotes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                      No credit notes issued for this subscription.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Proration Modal */}
      <ProrationModal
        isOpen={isProrationModalOpen}
        onClose={() => setIsProrationModalOpen(false)}
        subscription={sub}
        plans={subscriptionPlans}
        onConfirm={handleProrationConfirm}
      />

      {/* Cancellation & Credit Note Modal */}
      <CancellationModal
        isOpen={isCancellationModalOpen}
        onClose={() => setIsCancellationModalOpen(false)}
        subscription={sub}
        currentUser={currentUser}
        onConfirm={handleCancellationConfirm}
      />
    </div>
  );
};
