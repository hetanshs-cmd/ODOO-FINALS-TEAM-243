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
import { AIResult, AIAction } from '../services/ai/types';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { Quotation, QuotationLine, RiskLevel, ApprovalRole, User } from '../types';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatExactDateTime,
  formatWaitingTime,
} from '../utils/formatters';
import { computeBlendedRiskScore, getEffectiveDiscountLimit } from '../domain/discounts';
import { canUserPerformAction } from '../domain/permissions';
import { useApprovals } from '../hooks/useApprovals';
import { useQuotations } from '../hooks/useQuotations';
import { useUsers } from '../hooks/useUsers';
import { ApiApprovalRequest, ApiQuotation } from '../services/apiTypes';

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
  const navigate = useNavigate();

  const quotationsById = useMemo(() => new Map(quotations.map((q) => [q.id, q])), [quotations]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const getUserName = (id: string | null | undefined) => (id && usersById.get(id)?.name) || 'Unassigned';

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
          const matchReviewer = getUserName(a.assigned_to).toLowerCase().includes(query);
          const matchRequester = getUserName(a.requested_by).toLowerCase().includes(query);
          if (!matchCode && !matchReviewer && !matchRequester) return false;
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
          comparison = (qA?.customer_id || '').localeCompare(qB?.customer_id || '');
        }

        return sortOrder === 'desc' ? comparison : -comparison;
      });
  }, [approvals, quotationsById, usersById, quickFilter, searchQuery, riskFilter, sortKey, sortOrder]);

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

                      {/* 2. Customer — no customer-directory lookup on this
                          list page's scope; shown by id. */}
                      <td className="px-3 py-3 align-middle">
                        <div className="font-mono text-[11px] text-slate-600 max-w-[170px] truncate" title={q?.customer_id}>
                          {q?.customer_id || '—'}
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    quotations,
    approvalSteps,
    timelineEvents,
    users,
    approveQuotation,
    returnQuotation,
    rejectQuotation,
    logTimelineEvent,
  } = useDealStore();

  // Modal States
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Form Inputs
  const [actionNote, setActionNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Locate Quotation
  const quote = quotations.find((q) => q.id === id || q.code === id) || null;

  // If quote not found
  if (!quote) {
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

  // Filter steps and timeline events for this deal
  const quoteSteps = useMemo(() => {
    return approvalSteps.filter((s) => s.quotationId === quote.id || s.quotationId === quote.code);
  }, [quote, approvalSteps]);

  const quoteEvents = useMemo(() => {
    return timelineEvents.filter((e) => e.quotationId === quote.id || e.quotationId === quote.code);
  }, [quote, timelineEvents]);

  // Current pass
  const currentPass = quoteSteps.reduce((max, s) => Math.max(max, s.pass || 1), 1);

  // Active pass steps
  const activeSteps = quoteSteps.filter((s) => (s.pass || 1) === currentPass);
  const pendingStep = activeSteps.find((s) => s.status === 'Pending');

  // Approval Chain
  const chain: ApprovalRole[] = quote.requiredApprovers && quote.requiredApprovers.length > 0
    ? quote.requiredApprovers
    : quote.blendedRiskScore >= 65
    ? ['sales_manager', 'finance']
    : ['sales_manager'];

  const currentActiveRole: ApprovalRole = (pendingStep?.approverRole ||
    quote.currentApprovalRole ||
    chain[0]) as ApprovalRole;

  // Domain Blended Risk Explanation & Reasons
  const blendedRiskDetails = useMemo(() => {
    return computeBlendedRiskScore(quote.lines);
  }, [quote.lines]);

  // Evaluation of Line Limits: Compares discount given against stricter limit
  const evaluatedLines = useMemo(() => {
    return quote.lines.map((line) => {
      const limitResult = getEffectiveDiscountLimit(line.category, quote.customerTier);
      const discountGiven = line.discountPercent;
      const allowedLimit = limitResult.effectiveLimit;
      const overBy = Math.max(0, Number((discountGiven - allowedLimit).toFixed(2)));
      const isOver = overBy > 0;

      return {
        ...line,
        allowedLimit,
        overBy,
        isOver,
        governingRule: limitResult.governingRule,
        categoryLimit: limitResult.categoryLimit,
        tierLimit: limitResult.tierLimit,
      };
    });
  }, [quote.lines, quote.customerTier]);

  // Permission authorization checks
  const canApprove = useMemo(() => {
    if (!currentUser) return { allowed: false, reason: 'Not authenticated' };
    return canUserPerformAction(currentUser, 'approve_quotation', {
      quotation: quote,
      targetRole: currentActiveRole,
    });
  }, [currentUser, quote, currentActiveRole]);

  const canReturn = useMemo(() => {
    if (!currentUser) return { allowed: false, reason: 'Not authenticated' };
    return canUserPerformAction(currentUser, 'return_quotation', {
      quotation: quote,
      targetRole: currentActiveRole,
    });
  }, [currentUser, quote, currentActiveRole]);

  const canReject = useMemo(() => {
    if (!currentUser) return { allowed: false, reason: 'Not authenticated' };
    return canUserPerformAction(currentUser, 'reject_quotation', {
      quotation: quote,
      targetRole: currentActiveRole,
    });
  }, [currentUser, quote, currentActiveRole]);

  // Stage checks
  const isPendingApproval = quote.stage === 'PendingApproval' || quote.stage === 'Pending Approval';
  const isReturnedForRevision =
    quote.stage === 'Returned for Revision' || quote.stage === 'ReturnedForRevision';
  const isApproved = quote.stage === 'Approved';
  const isRejected = quote.stage === 'Rejected';

  // Sequential lock check: Is Finance trying to approve while Step 1 (Sales Manager) is still waiting?
  const isSequentialLockedForFinance =
    currentUser?.role.toLowerCase() === 'finance' &&
    currentActiveRole.toLowerCase().replace('_', '') === 'salesmanager' &&
    isPendingApproval;

  // Handlers for Governance Actions
  const handleApproveConfirm = () => {
    if (!currentUser) return;
    try {
      approveQuotation(quote.id, actionNote || 'Commercial terms reviewed and approved.');
      setIsApproveModalOpen(false);
      setActionNote('');
      setSuccessToast(`Quotation ${quote.code} successfully approved by ${currentUser.name}.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to approve quotation');
    }
  };

  const handleReturnConfirm = () => {
    if (!currentUser) return;
    if (!actionNote.trim()) {
      setErrorMessage('A revision note is required to explain why this quotation is being returned to the sales rep.');
      return;
    }
    try {
      returnQuotation(quote.id, actionNote);
      setIsReturnModalOpen(false);
      setActionNote('');
      setSuccessToast(`Quotation ${quote.code} returned to ${quote.repName} for revision.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to return quotation');
    }
  };

  const handleRejectConfirm = () => {
    if (!currentUser) return;
    if (!actionNote.trim()) {
      setErrorMessage('A rejection reason is required for governance audit records.');
      return;
    }
    try {
      rejectQuotation(quote.id, actionNote);
      setIsRejectModalOpen(false);
      setActionNote('');
      setSuccessToast(`Quotation ${quote.code} rejected.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to reject quotation');
    }
  };

  const quoteTotalValue = quote.grandTotal ?? quote.netAmount ?? quote.revenue ?? 0;

  // AI Decision Support & Approval Note Drafting State (Sections 15, 16, 17, 18)
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [isDraftNoteModalOpen, setIsDraftNoteModalOpen] = useState<boolean>(false);
  const [draftNoteBody, setDraftNoteBody] = useState<string>('');

  const getApprovalAiContext = () => {
    return {
      quotation: quote,
      customerName: quote.customerName,
      customerTier: quote.customerTier,
      quoteTotalValue: quote.grandTotal ?? quote.netAmount ?? quote.revenue ?? 0,
      marginPercent: quote.marginPercent || 40,
      approvalChain: chain,
      currentActiveRole,
      flaggedLines: evaluatedLines
        .filter((l) => l.isOver)
        .map((l) => ({
          productName: l.productName,
          category: l.category,
          discountPercent: l.discountPercent,
          allowedLimit: l.allowedLimit,
          overBy: l.overBy,
          lineTotal: l.lineTotal,
        })),
      worstLineOverBy: blendedRiskDetails.worstLineOverBy,
      auditReasons: blendedRiskDetails.reasons,
      userRole: currentUser?.role || 'sales_manager',
    };
  };

  const handleAiExplainApproval = async () => {
    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const res = await aiService.explainApproval(getApprovalAiContext());
      setAiResult(res);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate approval summary.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiDraftApprovalNote = async () => {
    setIsAiLoading(true);
    setAiErrorMessage(null);
    try {
      const res = await aiService.draftApprovalNote(getApprovalAiContext());
      const note = res.rationale || res.summary || '';
      setDraftNoteBody(note);
      setIsDraftNoteModalOpen(true);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to draft approval note.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
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
        title={`Approval Review: ${quote.code}`}
        description={`Commercial governance review for ${quote.customerName}. Verify line discounts, ceiling compliance, and sign-off chain.`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Approvals', href: '/approvals' },
          { label: quote.code },
        ]}
        badge={
          <div className="flex items-center gap-2">
            <RiskBadge
              level={quote.blendedRiskLevel || (quote.blendedRiskScore >= 70 ? 'HIGH' : 'MEDIUM')}
              score={quote.blendedRiskScore}
              size="md"
            />
            <StatusBadge status={quote.stage} size="md" />
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
            <Link
              to={`/quotations/${quote.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#714B67] bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors font-semibold"
              title="Open full editable quotation workbench on Screen 4"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Full Quotation
            </Link>
          </div>
        }
      />

      {/* 2. Top Summary Strip & Odoo Status Bar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Progression Bar */}
        <div className="bg-[#F8F9FA] p-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mr-2">
              Workflow Stage:
            </span>
            <div className="inline-flex items-center border border-slate-200 rounded bg-white overflow-hidden shadow-2xs text-[11px] font-medium">
              <div className="px-2.5 py-1 bg-emerald-50 text-emerald-900 font-bold border-r border-slate-200 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> Submitted
              </div>
              <div
                className={`px-2.5 py-1 border-r border-slate-200 flex items-center gap-1 ${
                  isApproved || (currentActiveRole.toLowerCase().includes('finance') && isPendingApproval)
                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                    : currentActiveRole.toLowerCase().includes('sales') && isPendingApproval
                    ? 'bg-[#714B67] text-white font-bold'
                    : isReturnedForRevision
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-400 bg-white'
                }`}
              >
                Sales Manager Review
              </div>
              {chain.some((r) => r.toLowerCase().includes('finance')) && (
                <div
                  className={`px-2.5 py-1 border-r border-slate-200 flex items-center gap-1 ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : currentActiveRole.toLowerCase().includes('finance') && isPendingApproval
                      ? 'bg-[#714B67] text-white font-bold'
                      : 'text-slate-400 bg-white'
                  }`}
                >
                  Finance Sign-Off
                </div>
              )}
              <div
                className={`px-2.5 py-1 ${
                  isApproved
                    ? 'bg-emerald-600 text-white font-bold'
                    : isRejected
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-slate-400 bg-white'
                }`}
              >
                {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Sign-Off Complete'}
              </div>
            </div>
          </div>

          {/* Smart Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              to={`/quotations/${quote.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-purple-600" />
              <span>Quotation Record</span>
            </Link>
            <a
              href="#audit-section"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Events ({quoteEvents.length})</span>
            </a>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-50 border border-purple-200 text-purple-900 font-semibold shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Pass {currentPass}</span>
            </span>
          </div>
        </div>

        {/* Detail Metadata Strip */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
            <div className="font-semibold text-slate-900 mt-0.5 truncate" title={quote.customerName}>
              {quote.customerName}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer Tier</span>
            <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
              <span className="text-amber-800 font-bold">{quote.customerTier} Tier</span>
              <span className="text-slate-400 text-[11px]">
                ({quote.customerTier === 'Gold' ? '15%' : quote.customerTier === 'Silver' ? '10%' : '5%'} ceiling)
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sales Rep</span>
            <div className="font-semibold text-slate-900 mt-0.5">{quote.repName || 'Sarah Chen'}</div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Net Value</span>
            <div className="font-mono font-bold text-slate-900 mt-0.5 text-sm">
              {formatCurrency(quoteTotalValue)}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gross Margin</span>
            <div className="font-mono font-bold text-slate-900 mt-0.5">
              {quote.marginPercent !== undefined ? formatPercent(quote.marginPercent) : '38.4%'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submitted</span>
            <div className="text-slate-600 font-medium mt-0.5" title={formatExactDateTime(quote.createdAt)}>
              {formatRelativeTime(quote.createdAt)}
            </div>
          </div>
        </div>

        {/* Special Status Banners */}
        {isReturnedForRevision && (
          <div className="p-3.5 bg-amber-50 border-t border-amber-200 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 uppercase tracking-wide">
                  Quotation Returned for Revision
                </span>
                <p className="text-amber-800 mt-0.5 font-medium">
                  <strong>Reviewer Feedback:</strong> &quot;{quote.revisionNote || 'Please reduce Services discount and resubmit.'}&quot;
                </p>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  The sales rep can edit order lines on Screen 4 and click &quot;Resubmit for Approval&quot;.
                </p>
              </div>
            </div>
            <Link
              to={`/quotations/${quote.id}`}
              className="shrink-0 px-3 py-1.5 bg-amber-700 text-white rounded font-semibold text-xs hover:bg-amber-800 transition-colors shadow-2xs"
            >
              Edit on Screen 4 ›
            </Link>
          </div>
        )}

        {isRejected && (
          <div className="p-3.5 bg-rose-50 border-t border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wide">Quotation Rejected</span>
              <p className="text-rose-800 mt-0.5 font-medium">
                This quotation was rejected during governance sign-off. Commercial execution is permanently halted.
              </p>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="p-3.5 bg-emerald-50 border-t border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wide">Governance Sign-Off Complete</span>
              <p className="text-emerald-800 mt-0.5 font-medium">
                All required approval tiers have signed off. This quotation is authorized for customer send and deal confirmation.
              </p>
            </div>
          </div>
        )}

        {isSequentialLockedForFinance && (
          <div className="p-3.5 bg-blue-50 border-t border-blue-200 flex items-start gap-2.5 text-xs text-blue-950">
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wide">Sequential Governance Active (Step 1 Pending)</span>
              <p className="text-blue-900 mt-0.5 font-medium">
                You are currently viewing as Finance. In accordance with DealFlow360 governance rules, Step 1 (Sales Manager) must complete approval before Step 2 (Finance Sign-Off) unlocks.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. SECTION 1: "Why This Quote Was Flagged" */}
      <Card
        title="Why This Quote Was Flagged (Governance Policy Audit)"
        subtitle="Identical mathematical breakdown of order lines exceeding customer tier or product category discount ceilings."
        padding="md"
        className="border-slate-200"
      >
        <div className="space-y-4">
          {/* Flagged Lines Table */}
          <div className="border border-slate-200 rounded-md overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Product & SKU</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Discount Given</th>
                  <th className="px-3 py-2.5 text-right">Allowed Limit</th>
                  <th className="px-3 py-2.5 text-right">Over By</th>
                  <th className="px-3 py-2.5 text-right">Line Total</th>
                  <th className="px-3.5 py-2.5 text-center">Governance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evaluatedLines.map((line) => (
                  <tr
                    key={line.id}
                    className={line.isOver ? 'bg-rose-50/40' : 'bg-white hover:bg-slate-50'}
                  >
                    <td className="px-3.5 py-2.5 align-middle">
                      <div className="font-semibold text-slate-900">{line.productName}</div>
                      {line.isSubscription && (
                        <span className="text-[10px] text-purple-700 font-medium">Recurring Subscription</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-middle text-slate-600 font-medium">
                      {line.category}
                    </td>

                    {/* Discount Given */}
                    <td className="px-3 py-2.5 text-right align-middle font-mono font-bold text-slate-900">
                      {formatPercent(line.discountPercent)}
                    </td>

                    {/* Allowed Limit */}
                    <td className="px-3 py-2.5 text-right align-middle font-mono text-slate-600">
                      <span className="font-semibold">{formatPercent(line.allowedLimit)}</span>
                      <span className="text-[10px] text-slate-400 block">
                        ({line.governingRule === 'category' ? `${line.category} rule` : `${quote.customerTier} rule`})
                      </span>
                    </td>

                    {/* Over By: Exact pts matching Screen 4 */}
                    <td className="px-3 py-2.5 text-right align-middle font-mono font-bold">
                      {line.isOver ? (
                        <span className="text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded">
                          +{line.overBy.toFixed(1)} pts
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-normal">0.0 pts</span>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="px-3 py-2.5 text-right align-middle font-mono font-semibold text-slate-900">
                      {formatCurrency(line.lineTotal)}
                    </td>

                    {/* Governance Status */}
                    <td className="px-3.5 py-2.5 text-center align-middle">
                      {line.isOver ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          OVER CEILING (+{line.overBy.toFixed(1)} pts)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          WITHIN LIMIT
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mathematical Explanation Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="md:col-span-1 p-3 bg-white rounded border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Blended Risk Assessment
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <RiskBadge
                    level={quote.blendedRiskLevel || (quote.blendedRiskScore >= 70 ? 'HIGH' : 'MEDIUM')}
                    score={quote.blendedRiskScore}
                    size="md"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Calculated deterministically from the worst single line violation ({blendedRiskDetails.worstLineOverBy} pts) and cumulative deal violations.
              </p>
            </div>

            <div className="md:col-span-2 p-3 bg-white rounded border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span>Governance Policy Audit Reasons:</span>
              </div>
              <ul className="space-y-1.5 text-slate-700">
                {blendedRiskDetails.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-600 font-bold mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
                <li className="flex items-start gap-1.5 text-slate-600">
                  <span className="text-purple-600 font-bold mt-0.5">•</span>
                  <span>
                    <strong>Stricter Limit Rule:</strong> For each product line, DealFlow360 applies the stricter ceiling between Customer Tier ({quote.customerTier} Tier ceiling) and Category Ceiling.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* AI Decision Support Card (Sections 15, 16, 17, 18) */}
      <Card
        title="AI Decision Support & Approval Summary (Advisory)"
        subtitle="Factors supporting approval vs factors requiring caution. Human reviewer must decide."
        padding="md"
        className="border-indigo-100 bg-indigo-50/20"
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              Generate an advisory summary analyzing commercial margin, strategic factors, and discount exceptions.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-ai-explain-approval"
                onClick={handleAiExplainApproval}
                disabled={isAiLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Explain in Plain Language</span>
              </button>
              <button
                type="button"
                id="btn-ai-draft-approval-note"
                onClick={handleAiDraftApprovalNote}
                disabled={isAiLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#5e3d55] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Draft Approval Note</span>
              </button>
            </div>
          </div>

          <AIInsightPanel
            title="Reviewer Intelligence & Trade-offs"
            result={aiResult}
            isLoading={isAiLoading}
            loadingMessage="Synthesizing multi-level approval context..."
            errorMessage={aiErrorMessage}
            onRetry={handleAiExplainApproval}
            onRefresh={handleAiExplainApproval}
            onActionClick={(action) => {
              if (action.type === 'draft_note') {
                handleAiDraftApprovalNote();
              }
            }}
          />
        </div>
      </Card>

      {/* 4. SECTION 2: Approval Chain & Sequential Progression */}
      <Card
        title="Multi-Tier Approval Chain & Review Steps"
        subtitle="Sequential review progression: Sales Manager approval is required before Finance director sign-off."
        padding="md"
        className="border-slate-200"
      >
        <ApprovalChainTimeline
          chain={chain}
          currentRole={currentActiveRole}
          steps={quoteSteps}
          activePass={currentPass}
        />
      </Card>

      {/* 5. SECTION 3: Action Area & Role-Based Enforcement Controls */}
      <Card
        title="Commercial Governance Actions"
        subtitle="Role-enforced sign-off controls. Actions depend on your active user role and sequential approval order."
        padding="md"
        className="border-slate-200"
      >
        <div className="space-y-4">
          {/* Identity Bar */}
          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-700" />
              <span>
                Currently acting as: <strong>{currentUser?.name}</strong>{' '}
                <span className="text-purple-800 font-mono">({currentUser?.role})</span>
              </span>
            </div>
          </div>

          {/* Role Status or Action Buttons */}
          {currentUser?.role.toLowerCase().includes('rep') ? (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Sales Representatives are forbidden from self-approving quotations. Awaiting sign-off by <strong>{pendingStep?.approverRole || 'Sales Manager'}</strong>.
                </span>
              </div>
              {isReturnedForRevision && (
                <Link
                  to={`/quotations/${quote.id}`}
                  className="px-3 py-1.5 bg-[#714B67] text-white rounded font-semibold text-xs hover:bg-[#5d3b53] transition-colors"
                >
                  Edit Quotation on Screen 4
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-600">
                {isApproved ? (
                  <span className="text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Quotation is fully approved. No further actions required.
                  </span>
                ) : isRejected ? (
                  <span className="text-rose-800 font-semibold flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Quotation was rejected. Commercial workflow is terminated.
                  </span>
                ) : canApprove.allowed ? (
                  <span className="text-slate-700 font-medium">
                    You have authorization to sign off on this step as <strong>{currentUser?.role}</strong>.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {canApprove.reason || 'Actions locked for current step.'}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canReturn.allowed || isApproved || isRejected}
                  onClick={() => {
                    setErrorMessage(null);
                    setActionNote('');
                    setIsReturnModalOpen(true);
                  }}
                  className="border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-40"
                  icon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
                >
                  Return for Revision
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={!canReject.allowed || isApproved || isRejected}
                  onClick={() => {
                    setErrorMessage(null);
                    setActionNote('');
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
                  disabled={!canApprove.allowed || isApproved || isRejected}
                  onClick={() => {
                    setErrorMessage(null);
                    setActionNote('');
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

      {/* 6. SECTION 4: Live Governance Audit Trail */}
      <div id="audit-section">
        <Card
          title="Governance Audit Trail & Revision History"
          subtitle="Immutable timeline of quote submissions, discount evaluations, returns, and sign-offs."
          padding="md"
          className="border-slate-200"
        >
          <AuditTrail events={quoteEvents} />
        </Card>
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* ACTION MODALS */}
      {/* -------------------------------------------------------------------------------- */}

      {/* 1. APPROVE MODAL */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title={`Approve Quotation: ${quote.code}`}
        description={`Signing off as ${currentUser?.name} (${currentUser?.role}).`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApproveConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm Sign-Off
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">
              {errorMessage}
            </div>
          )}

          <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-emerald-950">
            <div className="font-semibold">Workflow Consequence:</div>
            <p className="mt-0.5 text-[11px] text-emerald-800">
              {currentActiveRole.toLowerCase().replace('_', '') === 'salesmanager' && chain.some((r) => r.toLowerCase().includes('finance'))
                ? 'Approving Step 1 will advance this quotation to Step 2 (Finance Review).'
                : 'Approving this final step will mark the quotation as Approved and unlock customer sending.'}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Approval Note (Optional):
            </label>
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

      {/* 2. RETURN FOR REVISION MODAL */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Return Quotation for Revision: ${quote.code}`}
        description="Send this quotation back to the sales rep with required revision feedback."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReturnModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturnConfirm}
              className="bg-amber-600 hover:bg-amber-700 border-amber-600"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Confirm Return to Rep
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">
              {errorMessage}
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-950">
            <div className="font-semibold">Revision Loop:</div>
            <p className="mt-0.5 text-[11px] text-amber-800">
              This quotation will transition to <strong>Returned for Revision</strong> stage and will be unlocked for line editing by <strong>{quote.repName}</strong>.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Required Reviewer Feedback Note <span className="text-rose-600">*</span>:
            </label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="e.g., Services discount is 18% (limit 10%). Reduce Services discount to at most 12% or require pre-payment terms."
              rows={3}
              className="w-full p-2.5 border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>
      </Modal>

      {/* 3. REJECT MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={`Reject Quotation: ${quote.code}`}
        description="Permanently halt commercial execution of this deal."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectConfirm}
              icon={<XCircle className="w-3.5 h-3.5" />}
            >
              Permanently Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">
              {errorMessage}
            </div>
          )}

          <div className="p-3 bg-rose-50 rounded border border-rose-200 text-rose-950">
            <div className="font-semibold">Irreversible Governance Action:</div>
            <p className="mt-0.5 text-[11px] text-rose-800">
              Rejecting this quotation transitions it to <strong>Rejected</strong> stage. The sales rep cannot resubmit or confirm this deal.
            </p>
          </div>

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
