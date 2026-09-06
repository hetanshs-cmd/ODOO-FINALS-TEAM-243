import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  Filter,
  Search,
  ArrowLeft,
  ArrowUpDown,
  UserCheck,
  Building2,
  DollarSign,
  AlertCircle,
  Info,
  Check,
  Lock,
  MessageSquare,
  History,
  Sparkles,
  Layers,
  FileText,
  Percent,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { StatusBadge, RiskBadge, Badge } from '../components/ui/Badge';
import { ApprovalChainTimeline } from '../components/domain/ApprovalChainTimeline';
import { AuditTrail } from '../components/domain/AuditTrail';
import { aiService } from '../services/ai/aiService';
import { AIInsightPanel } from '../components/ai/AIInsightPanel';
import { AIDraftEditorModal } from '../components/ai/AIDraftEditorModal';
import { AIResult } from '../services/ai/types';
import { useAuth } from '../hooks/useAuth';
import { Quotation, QuotationLine, RiskLevel, ApprovalRole, User } from '../types';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatExactDateTime,
  formatWaitingTime,
  humanizeStatus,
} from '../utils/formatters';
import { computeBlendedRiskScore, getEffectiveDiscountLimit } from '../domain/discounts';
import { canUserPerformAction } from '../domain/permissions';
import { useApprovals } from '../hooks/useApprovals';
import { useQuotations, useQuotation } from '../hooks/useQuotations';
import { useUsers } from '../hooks/useUsers';
import { useCustomers } from '../hooks/useCustomers';
import { approvalService, quotationService } from '../services';
import { ApiApprovalRequest, ApiQuotation, ApiApprovalAction, ApiTimelineEvent } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';
import { DealEvent } from '../types';

// --------------------------------------------------------------------------------------
// SCREEN 5: Approvals List Page
// --------------------------------------------------------------------------------------

// Real ApiApprovalStatus has no "Returned for Revision" status like the mock
// store did — the closest real equivalent to a stalled/kicked-back approval
// is ESCALATED, so the "Returned" quick filter/tab is repointed to it below.
type ApprovalQuickFilter = 'pending' | 'high_risk' | 'finance' | 'escalated' | 'all';
type ApprovalSortKey = 'waiting_time' | 'submitted' | 'risk' | 'value' | 'customer';

export const ApprovalsListPage: React.FC = () => {
  const { approvals, loading, refetch } = useApprovals();
  const { quotations } = useQuotations();
  const { users } = useUsers();
  const { customers } = useCustomers();
  const navigate = useNavigate();

  const quotationsById = useMemo(() => new Map(quotations.map((q) => [q.id, q])), [quotations]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const getUserName = (id: string | null | undefined) => (id && usersById.get(id)?.name) || 'Unassigned';
  const getCustomerName = (id: string | null | undefined) => (id && customersById.get(id)?.name) || 'Unknown Customer';

  // Approximate risk from discount-to-subtotal ratio — the real API has no
  // per-line risk score (see the same approximation in QuotationsListPage).
  const getApproxRisk = (q?: ApiQuotation): { level: RiskLevel; discountPct: number } => {
    if (!q) return { level: 'LOW', discountPct: 0 };
    const subtotal = parseFloat(q.subtotal) || 0;
    const discount = parseFloat(q.discount_total) || 0;
    const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
    const level: RiskLevel = discountPct > 15 ? 'HIGH' : discountPct > 7 ? 'MEDIUM' : 'LOW';
    return { level, discountPct };
  };

  // Filter States
  const [quickFilter, setQuickFilter] = useState<ApprovalQuickFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<ApprovalSortKey>('waiting_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Compute metric pills across all governance approval requests
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let highRiskCount = 0;
    let escalatedCount = 0;
    let approvedCount = 0;

    for (const a of approvals) {
      if (a.status === 'PENDING') pendingCount++;
      if (a.status === 'ESCALATED') escalatedCount++;
      if (a.status === 'APPROVED') approvedCount++;
      if (getApproxRisk(quotationsById.get(a.quotation_id)).level === 'HIGH') highRiskCount++;
    }

    return { pendingCount, highRiskCount, returnedCount: escalatedCount, approvedCount };
  }, [approvals, quotationsById]);

  // Filter and sort approval requests
  const filteredApprovals = useMemo(() => {
    return approvals
      .filter((a) => {
        const q = quotationsById.get(a.quotation_id);
        const { level: riskLevel } = getApproxRisk(q);
        const isHighRisk = riskLevel === 'HIGH';
        const isFinanceRequired = (a.approval_level || '').toLowerCase().includes('finance');

        // Quick filter tabs
        if (quickFilter === 'pending' && a.status !== 'PENDING') return false;
        if (quickFilter === 'high_risk' && !isHighRisk) return false;
        if (quickFilter === 'finance' && !isFinanceRequired) return false;
        if (quickFilter === 'escalated' && a.status !== 'ESCALATED') return false;

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchCode = (q?.quotation_number || '').toLowerCase().includes(query);
          const matchCustomer = getCustomerName(q?.customer_id).toLowerCase().includes(query);
          const matchReviewer = getUserName(a.assigned_to).toLowerCase().includes(query);
          const matchRequester = getUserName(a.requested_by).toLowerCase().includes(query);
          if (!matchCode && !matchCustomer && !matchReviewer && !matchRequester) return false;
        }

        // Risk filter dropdown
        if (riskFilter !== 'ALL' && riskLevel !== riskFilter) return false;

        return true;
      })
      .sort((a, b) => {
        const qA = quotationsById.get(a.quotation_id);
        const qB = quotationsById.get(b.quotation_id);

        let comparison = 0;
        if (sortKey === 'waiting_time') {
          const timeA = new Date(a.requested_at).getTime() || 0;
          const timeB = new Date(b.requested_at).getTime() || 0;
          comparison = timeA - timeB; // Older time means longer waiting time
        } else if (sortKey === 'submitted') {
          const timeA = new Date(a.requested_at).getTime() || 0;
          const timeB = new Date(b.requested_at).getTime() || 0;
          comparison = timeB - timeA;
        } else if (sortKey === 'risk') {
          comparison = getApproxRisk(qB).discountPct - getApproxRisk(qA).discountPct;
        } else if (sortKey === 'value') {
          const valA = parseFloat(qA?.grand_total || '0') || 0;
          const valB = parseFloat(qB?.grand_total || '0') || 0;
          comparison = valB - valA;
        } else if (sortKey === 'customer') {
          comparison = getCustomerName(qA?.customer_id).localeCompare(getCustomerName(qB?.customer_id));
        }

        return sortOrder === 'desc' ? comparison : -comparison;
      });
  }, [approvals, quotationsById, usersById, customersById, quickFilter, searchQuery, riskFilter, sortKey, sortOrder]);

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Page Header with exact title, subtitle, and compact secondary metrics */}
      <PageHeader
        title="Approvals"
        description="Review quotations that exceed governance thresholds and require action."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Approvals' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending: {metrics.pendingCount}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>High Risk: {metrics.highRiskCount}</span>
            </span>
          </div>
        }
      />

      {/* 2. Quick Filter Tabs & Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Filter Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-md border border-slate-200 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setQuickFilter('pending')}
              className={`px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${
                quickFilter === 'pending'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Only ({metrics.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('high_risk')}
              className={`px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${
                quickFilter === 'high_risk'
                  ? 'bg-white text-rose-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              High Risk ({metrics.highRiskCount})
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('finance')}
              className={`px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${
                quickFilter === 'finance'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Finance Required
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('escalated')}
              className={`px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${
                quickFilter === 'escalated'
                  ? 'bg-white text-amber-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Escalated ({metrics.returnedCount})
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`px-3 py-1.5 rounded font-medium transition-all whitespace-nowrap ${
                quickFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Approvals
            </button>
          </div>

          {/* Secondary Stats */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>Approved: <strong className="text-emerald-700">{metrics.approvedCount}</strong></span>
            <span>•</span>
            <span>Escalated: <strong className="text-amber-700">{metrics.returnedCount}</strong></span>
          </div>
        </div>

        {/* Search, Risk & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotation ID, customer name, sales rep, or reviewer..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk Only</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as ApprovalSortKey)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
            >
              <option value="waiting_time">Sort: Waiting Time</option>
              <option value="submitted">Sort: Submission Date</option>
              <option value="risk">Sort: Risk Score</option>
              <option value="value">Sort: Deal Value</option>
              <option value="customer">Sort: Customer Name</option>
            </select>

            {(searchQuery || riskFilter !== 'ALL' || quickFilter !== 'pending') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRiskFilter('ALL');
                  setQuickFilter('pending');
                }}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Data Table with 10 exact specified columns */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-3.5 py-2.5">Quotation</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Requested By</th>
                <th className="px-3 py-2.5">Blended Risk</th>
                <th className="px-3 py-2.5">Approval Status</th>
                <th className="px-3 py-2.5">Approval Level</th>
                <th className="px-3 py-2.5">Assigned Reviewer</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3.5 py-2.5 text-right">Waiting Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-xs">
                    Loading approvals…
                  </td>
                </tr>
              ) : filteredApprovals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-slate-800 text-sm">No approvals found</div>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No approval requests match the active governance filters. Adjust your search criteria or switch to &quot;All Approvals&quot;.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickFilter('all');
                        setSearchQuery('');
                        setRiskFilter('ALL');
                      }}
                      className="mt-3 px-3 py-1.5 bg-[#714B67] text-white rounded text-xs font-semibold hover:bg-[#5d3b53] transition-colors"
                    >
                      Show All Approvals
                    </button>
                  </td>
                </tr>
              ) : (
                filteredApprovals.map((a) => {
                  const q = quotationsById.get(a.quotation_id);
                  const { level: riskLevel, discountPct } = getApproxRisk(q);
                  const isHighRisk = riskLevel === 'HIGH';
                  const isPending = a.status === 'PENDING';
                  const isEscalated = a.status === 'ESCALATED';
                  const quoteAmount = parseFloat(q?.grand_total || '0') || 0;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/approvals/${a.quotation_id}`)}
                      className={`cursor-pointer transition-colors hover:bg-purple-50/40 ${
                        isHighRisk && isPending
                          ? 'bg-rose-50/20'
                          : isPending
                          ? 'bg-amber-50/15'
                          : isEscalated
                          ? 'bg-amber-50/30'
                          : 'bg-white'
                      }`}
                    >
                      {/* 1. Quotation: number in bold monospace + net amount */}
                      <td className="px-3.5 py-3 whitespace-nowrap align-middle">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-[#714B67] hover:underline flex items-center gap-1">
                            <span>{q?.quotation_number || a.quotation_id}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 opacity-60" />
                          </span>
                          <span className="font-mono font-semibold text-slate-900 text-[11px] mt-0.5">
                            {formatCurrency(quoteAmount)}
                          </span>
                        </div>
                      </td>

                      {/* 2. Customer */}
                      <td className="px-3 py-3 align-middle">
                        <div className="text-[13px] font-medium text-slate-800 max-w-[170px] truncate" title={getCustomerName(q?.customer_id)}>
                          {getCustomerName(q?.customer_id)}
                        </div>
                      </td>

                      {/* 3. Requested By */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle text-slate-700 font-medium">
                        {getUserName(a.requested_by)}
                      </td>

                      {/* 4. Blended Risk (approximated — see getApproxRisk) */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <RiskBadge level={riskLevel} score={Math.round(discountPct)} size="sm" />
                      </td>

                      {/* 5. Approval Status */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <StatusBadge status={a.status} size="sm" />
                      </td>

                      {/* 6. Approval Level */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            a.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isEscalated
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : (a.approval_level || '').toLowerCase().includes('finance')
                              ? 'bg-blue-50 text-blue-900 border-blue-200 font-semibold'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {a.approval_level || '—'}
                        </span>
                      </td>

                      {/* 7. Assigned Reviewer */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{getUserName(a.assigned_to)}</span>
                        </div>
                      </td>

                      {/* 8. Submitted */}
                      <td className="px-3 py-3 whitespace-nowrap align-middle text-slate-500 font-mono text-[11px]">
                        {formatExactDateTime(a.requested_at)}
                      </td>

                      {/* 9. Waiting Time: dynamic calculated time */}
                      <td className="px-3.5 py-3 whitespace-nowrap align-middle text-right">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 text-[11px]">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            {formatWaitingTime(a.requested_at)}
                          </span>
                        ) : isEscalated ? (
                          <span className="text-[11px] text-amber-700 font-mono italic">
                            Escalated ({formatRelativeTime(a.responded_at || a.requested_at)})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatRelativeTime(a.responded_at || a.requested_at)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------------------
// SCREEN 6: Approval Detail Page
// --------------------------------------------------------------------------------------

export const ApprovalDetailPage: React.FC = () => {
  // NOTE: the (not-yet-migrated) ApprovalsListPage above navigates here with
  // the *quotation* id (`/approvals/${q.id}`). Rather than touch that list's
  // routing, this detail page treats `id` as a quotation id and resolves the
  // matching ApiApprovalRequest by filtering — so existing navigation keeps
  // working across the migration boundary.
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { quotation, loading: quoteLoading, error: quoteError, refetch: refetchQuotation } = useQuotation(id);
  const { approvals, loading: approvalsLoading, refetch: refetchApprovals } = useApprovals(
    quotation ? { quotation_id: quotation.id } : undefined
  );
  const { customers } = useCustomers();
  const customerName =
    (quotation && customers.find((c) => c.id === quotation.customer_id)?.name) || quotation?.customer_id || '—';

  const [timeline, setTimeline] = useState<ApiTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!quotation) return;
    setTimelineLoading(true);
    quotationService
      .getTimeline(quotation.id)
      .then((events) => {
        if (!cancelled) setTimeline(events);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quotation]);

  // Modal states
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  // AI Insights — real local-model-backed calls, grounded in this approval
  // request's live DB record via backend/src/modules/ai.
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  if (quoteLoading || approvalsLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-xs text-slate-500">
        Loading approval record…
      </div>
    );
  }

  if (quoteError || !quotation) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Quotation Record Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          The requested quotation ID <strong>{id}</strong> could not be located in the operational database.
        </p>
        <Link
          to="/approvals"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#714B67] text-white rounded text-xs font-semibold hover:bg-[#5d3b53] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Approvals Queue
        </Link>
      </div>
    );
  }

  // Most recent approval request for THIS quotation (there may be several
  // across resubmissions/escalations). The list is already scoped server-side
  // by quotation_id, but filter again defensively so a stray row can never
  // make the action buttons act on another quotation's request.
  const quotationApprovals = approvals.filter((a) => a.quotation_id === quotation.id);
  const approval: ApiApprovalRequest | null = quotationApprovals.length
    ? [...quotationApprovals].sort(
        (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime(),
      )[0]
    : null;

  const isPending = approval?.status === 'PENDING';
  const isApproved = approval?.status === 'APPROVED';
  const isRejected = approval?.status === 'REJECTED';
  const isEscalated = approval?.status === 'ESCALATED';

  // No real-backend concept of role-scoped governance permissions (that
  // engine — canUserPerformAction — is wired to the mock Quotation/User
  // shapes). Simplified to: reps never act; anyone else may act while
  // PENDING. TODO: replace with a real per-role authorization check once
  // the backend exposes approval_level -> role mapping.
  const isRep = (currentUser?.role || '').toLowerCase().includes('rep');
  const canAct = !isRep && isPending;

  const quoteTotalValue = Number(quotation.grand_total);

  const act = async (action: ApiApprovalAction, note: string, successMsg: string, closeModal: () => void) => {
    if (!approval) return;
    setIsActing(true);
    setErrorMessage(null);
    try {
      await approvalService.act(approval.id, action, note || undefined);
      closeModal();
      setActionNote('');
      setSuccessToast(successMsg);
      setTimeout(() => setSuccessToast(null), 4000);
      await Promise.all([refetchApprovals(), refetchQuotation()]);
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to record the approval action.');
    } finally {
      setIsActing(false);
    }
  };

  const handleApproveConfirm = () => act('APPROVED', actionNote, `Quotation ${quotation.quotation_number} approved.`, () => setIsApproveModalOpen(false));

  const handleRejectConfirm = () => {
    if (!actionNote.trim()) {
      setErrorMessage('A rejection reason is required for governance audit records.');
      return;
    }
    act('REJECTED', actionNote, `Quotation ${quotation.quotation_number} rejected.`, () => setIsRejectModalOpen(false));
  };

  // The mock store's "Return for Revision" reopened the quotation for line
  // edits — there is no equivalent backend transition. Closest available
  // action is ESCALATED (flags it for further review) plus the note; this
  // does not reopen the quotation for editing like the old mock flow did.
  const handleReturnConfirm = () => {
    if (!actionNote.trim()) {
      setErrorMessage('A revision note is required to explain why this quotation needs further review.');
      return;
    }
    act(
      'ESCALATED',
      actionNote,
      `Quotation ${quotation.quotation_number} flagged for revision (escalated).`,
      () => setIsReturnModalOpen(false)
    );
  };

  const handleExplainApproval = async () => {
    if (!approval) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiService.getInsight('explain_approval', approval.id);
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : 'The local AI model is unavailable. It may not be running.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDraftNote = async () => {
    if (!approval) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiService.getInsight('draft_approval_note', approval.id);
      setAiResult(result);
      setShowDraftModal(true);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : 'The local AI model is unavailable. It may not be running.');
    } finally {
      setAiLoading(false);
    }
  };

  const auditEvents: DealEvent[] = timeline.map((e) => ({
    id: e.id,
    type: e.action,
    description: humanizeStatus(e.action),
    user: e.user_id || 'system',
    timestamp: e.created_at,
  })) as unknown as DealEvent[];

  return (
    <div className="space-y-6 pb-20">
      {successToast && (
        <div className="fixed top-18 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold bg-emerald-50 border border-emerald-300 text-emerald-900">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* 1. Header & Navigation */}
      <PageHeader
        title={`Approval Review: ${quotation.quotation_number}`}
        description={`Commercial governance review for customer ${customerName}.`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Approvals', href: '/approvals' },
          { label: quotation.quotation_number },
        ]}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={approval?.status || quotation.status} size="md" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/approvals"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Queue
            </Link>
          </div>
        }
      />

      {/* 2. Summary Strip */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
            <div className="font-semibold text-slate-900 mt-0.5 truncate" title={quotation.customer_id}>
              {customerName}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
            <div className="font-semibold text-slate-900 mt-0.5">
              <StatusBadge status={quotation.status} size="sm" />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Approval Level</span>
            <div className="font-semibold text-slate-900 mt-0.5">{approval?.approval_level || '—'}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Value</span>
            <div className="font-mono font-bold text-slate-900 mt-0.5 text-sm">
              {formatCurrency(quoteTotalValue)}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Discount Total</span>
            <div className="font-mono font-bold text-slate-900 mt-0.5">
              {formatCurrency(Number(quotation.discount_total))}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submitted</span>
            <div className="text-slate-600 font-medium mt-0.5" title={formatExactDateTime(quotation.created_at)}>
              {approval ? formatRelativeTime(approval.requested_at) : formatRelativeTime(quotation.created_at)}
            </div>
          </div>
        </div>

        {isEscalated && (
          <div className="p-3.5 bg-amber-50 border-t border-amber-200 flex items-start gap-2.5 text-xs">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 uppercase tracking-wide">Escalated / Flagged for Revision</span>
              <p className="text-amber-800 mt-0.5 font-medium">
                <strong>Reviewer Feedback:</strong> &quot;{approval?.reason || 'No note recorded.'}&quot;
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="p-3.5 bg-rose-50 border-t border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wide">Quotation Rejected</span>
              <p className="text-rose-800 mt-0.5 font-medium">{approval?.reason || 'Rejected during governance sign-off.'}</p>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="p-3.5 bg-emerald-50 border-t border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wide">Governance Sign-Off Complete</span>
              <p className="text-emerald-800 mt-0.5 font-medium">
                This approval request has been signed off. This quotation is authorized to proceed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Line items (real ApiQuotationItem rows — no product name/category
          from this endpoint, shown by product_id; TODO enrich via a products
          lookup if/when one is added to this page's scope). */}
      <Card
        title="Quotation Line Items"
        subtitle="Items as recorded on the quotation. Discount governance detail (tier/category ceilings) is computed server-side and is not re-derived here."
        padding="md"
        className="border-slate-200"
      >
        <div className="border border-slate-200 rounded-md overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-3.5 py-2.5">Product ID</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Unit Price</th>
                <th className="px-3 py-2.5 text-right">Discount %</th>
                <th className="px-3 py-2.5 text-right">Tax %</th>
                <th className="px-3.5 py-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quotation.items || []).map((line) => (
                <tr key={line.id} className="bg-white hover:bg-slate-50">
                  <td className="px-3.5 py-2.5 align-middle font-mono text-slate-700">{line.product_id}</td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono">{line.quantity}</td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono">{formatCurrency(Number(line.unit_price))}</td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono">{formatPercent(Number(line.discount_percent))}</td>
                  <td className="px-3 py-2.5 text-right align-middle font-mono">{formatPercent(Number(line.tax_percent))}</td>
                  <td className="px-3.5 py-2.5 text-right align-middle font-mono font-semibold text-slate-900">
                    {formatCurrency(Number(line.line_total))}
                  </td>
                </tr>
              ))}
              {(!quotation.items || quotation.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">No line items.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Actions */}
      <Card
        title="Commercial Governance Actions"
        subtitle="Actions call the real approvals API (approvalService.act) and are recorded against the current approval request."
        padding="md"
        className="border-slate-200"
      >
        <div className="space-y-4">
          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-700" />
              <span>
                Currently acting as: <strong>{currentUser?.name}</strong>{' '}
                <span className="text-purple-800 font-mono">({currentUser?.role})</span>
              </span>
            </div>
          </div>

          {!approval ? (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>No approval request is on record for this quotation yet.</span>
            </div>
          ) : isRep ? (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Sales Representatives are forbidden from self-approving quotations.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-600">
                {isApproved ? (
                  <span className="text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Approved. No further actions required.
                  </span>
                ) : isRejected ? (
                  <span className="text-rose-800 font-semibold flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-600" /> Rejected. Workflow terminated.
                  </span>
                ) : canAct ? (
                  <span className="text-slate-700 font-medium">You may act on this pending approval request.</span>
                ) : (
                  <span className="text-amber-800 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Actions locked — request is not pending.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canAct}
                  onClick={() => {
                    setErrorMessage(null);
                    setIsReturnModalOpen(true);
                  }}
                  className="border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-40"
                  icon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
                >
                  Escalate / Return
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={!canAct}
                  onClick={() => {
                    setErrorMessage(null);
                    setIsRejectModalOpen(true);
                  }}
                  className="disabled:opacity-40"
                  icon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Reject Quotation
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canAct}
                  onClick={() => {
                    setErrorMessage(null);
                    setIsApproveModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 disabled:opacity-40"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Approve Quotation
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* AI Insights — real local-model-backed calls */}
      {approval && (
        <Card
          title="AI Insights"
          subtitle="Grounded in this approval request's live record via the local AI model."
          padding="md"
          className="border-slate-200"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} isLoading={aiLoading} onClick={handleExplainApproval}>
                Explain Approval
              </Button>
              <Button variant="outline" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} isLoading={aiLoading} disabled={!canAct} onClick={handleDraftNote}>
                Draft Note
              </Button>
            </div>
            {(aiResult || aiLoading || aiError) && (
              <AIInsightPanel
                result={aiResult}
                isLoading={aiLoading}
                loadingMessage="Consulting the local AI model…"
                errorMessage={aiError}
                onRetry={handleExplainApproval}
                compact
              />
            )}
          </div>
        </Card>
      )}

      {showDraftModal && aiResult?.summary && (
        <AIDraftEditorModal
          isOpen={showDraftModal}
          onClose={() => setShowDraftModal(false)}
          title="Draft Approval Note"
          initialBody={aiResult.summary}
          actionButtonLabel="Use This Note"
          onApplyOrSend={(body) => {
            setActionNote(body);
            setShowDraftModal(false);
            setErrorMessage(null);
          }}
        />
      )}

      {/* 5. Live Audit Trail (real quotation timeline endpoint) */}
      <div id="audit-section">
        <Card
          title="Governance Audit Trail & Revision History"
          subtitle="Backed by GET /quotations/:id/timeline (audit-log)."
          padding="md"
          className="border-slate-200"
        >
          {timelineLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading audit trail…</div>
          ) : (
            <AuditTrail events={auditEvents} />
          )}
        </Card>
      </div>

      {/* ACTION MODALS */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title={`Approve Quotation: ${quotation.quotation_number}`}
        description={`Signing off as ${currentUser?.name} (${currentUser?.role}).`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsApproveModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApproveConfirm}
              disabled={isActing}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm Sign-Off
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{errorMessage}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Approval Note (Optional):</label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="e.g., Exception authorized based on annual contract volume commitment."
              rows={3}
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Escalate / Return Quotation: ${quotation.quotation_number}`}
        description="Flags this quotation with reviewer feedback (mapped to the ESCALATED action — the backend has no separate 'return-for-revision' transition)."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsReturnModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturnConfirm}
              disabled={isActing}
              className="bg-amber-600 hover:bg-amber-700 border-amber-600"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{errorMessage}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Required Reviewer Feedback Note <span className="text-rose-600">*</span>:
            </label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="e.g., Services discount is 18% (limit 10%). Reduce Services discount to at most 12%."
              rows={3}
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={`Reject Quotation: ${quotation.quotation_number}`}
        description="Permanently halt commercial execution of this deal."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectConfirm}
              disabled={isActing}
              icon={<XCircle className="w-3.5 h-3.5" />}
            >
              Permanently Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{errorMessage}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Rejection Reason <span className="text-rose-600">*</span>:
            </label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="e.g., Unacceptable margin dilution below corporate threshold."
              rows={3}
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-rose-600"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
