import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge, RiskBadge } from '../components/ui/Badge';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { quotations, dealHealthFlags, approvalSteps, customers, upsellSuggestions } = useDealStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Metrics calculations
  const pendingApprovals = quotations.filter(
    (q) => q.stage === 'Pending Approval' || q.stage === 'PendingApproval'
  );
  const openQuotations = quotations.filter(
    (q) =>
      q.stage === 'Draft' ||
      q.stage === 'Pending Approval' ||
      q.stage === 'PendingApproval' ||
      q.stage === 'Negotiation' ||
      q.stage === 'Sent'
  );
  const atRiskDeals = quotations.filter(
    (q) => q.blendedRiskValue === 'HIGH' || q.blendedRiskScore >= 70
  );
  const totalPipelineRevenue = openQuotations.reduce(
    (sum, q) => sum + (q.grandTotal || q.totalAmount || 0),
    0
  );

  // Recent quotations (sorted by activity)
  const recentQuotations = [...quotations]
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .slice(0, 5);

  // Unresolved deal health flags
  const activeFlags = dealHealthFlags.filter((f) => !f.isResolved).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* ERP Dashboard Header — Section 13 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-[#4B5563] mt-0.5">
            Monitor active deals, approvals, fulfillment, and risk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#1F2937] bg-white border border-[#D1D5DB] px-3 py-1.5 rounded-[6px] hover:bg-[#F8F9FA] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Quotations</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/quotations/new')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#714B67] hover:bg-[#62415A] text-white px-3.5 py-1.5 rounded-[6px] shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* COMPACT KPI METRIC BAR — Section 13 & 20 (height ~90-120px) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-3.5 rounded-[8px] border border-[#E5E7EB] shadow-2xs">
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            Pending Approvals
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-[#1F2937]">{pendingApprovals.length}</div>
            <span className="text-[11px] font-medium text-[#B45309] bg-[#FFFBEB] px-1.5 py-0.5 rounded border border-[#FDE68A]">
              Action Required
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">
            Needs Sales Mgr or Finance sign-off
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[8px] border border-[#E5E7EB] shadow-2xs">
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            Open Quotations
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-[#1F2937]">{openQuotations.length}</div>
            <span className="text-[11px] font-medium text-[#2E7D32] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
              Active
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">
            Across {customers.length} enterprise accounts
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[8px] border border-[#E5E7EB] shadow-2xs">
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            At-Risk Deals
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-[#1F2937]">{atRiskDeals.length}</div>
            <span className="text-[11px] font-medium text-[#B91C1C] bg-[#FEF2F2] px-1.5 py-0.5 rounded border border-[#FECACA]">
              Over Limit
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">
            Exceeding permitted discount tiers
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[8px] border border-[#E5E7EB] shadow-2xs">
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            Pipeline Volume
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-[#1F2937]">
              {formatCurrency(totalPipelineRevenue)}
            </div>
            <span className="text-[11px] font-medium text-[#714B67] bg-[#F4EEF3] px-1.5 py-0.5 rounded border border-[#E8DCE7]">
              In Flight
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">
            Calculated at current deal stages
          </div>
        </div>
      </div>

      {/* OPERATIONAL WORKBENCH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT 2 COLS: In-Flight Quotations & Approval Queue */}
        <div className="lg:col-span-2 space-y-5">
          {/* In-Flight Quotations Table (Dense ERP Table) */}
          <div className="bg-white rounded-[8px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E5E7EB] flex items-center justify-between bg-white">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1F2937]">In-Flight Quotations</h3>
                <p className="text-[11px] text-[#6B7280]">
                  Live commercial deals, margin health, and risk levels
                </p>
              </div>
              <Link
                to="/quotations"
                className="text-xs font-semibold text-[#714B67] hover:underline flex items-center gap-1"
              >
                <span>All Quotes ({quotations.length})</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F7F7F8] text-[#6B7280] border-b border-[#E4E4E7] font-semibold">
                    <th className="py-2.5 px-3">Number</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Discount</th>
                    <th className="py-2.5 px-3 text-center">Risk</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {recentQuotations.map((q) => {
                    const effDiscount =
                      q.subtotal > 0 ? (q.totalDiscount / q.subtotal) * 100 : 0;
                    return (
                      <tr
                        key={q.id}
                        onClick={() => navigate(`/quotations/${q.id}`)}
                        className="hover:bg-[#FAF5F8]/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#714B67] group-hover:underline">
                          {q.code}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#182033] truncate max-w-[150px]">
                          {q.customerName}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#182033] text-right">
                          {formatCurrency(q.grandTotal || q.totalAmount || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-[#4B5563]">
                            {effDiscount.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <RiskBadge risk={q.blendedRiskValue} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={q.stage} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-[11px] font-semibold text-[#714B67] group-hover:underline">
                            Open →
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approval Queue */}
          <div className="bg-white rounded-lg border border-[#E4E4E7] shadow-2xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-sm font-bold text-[#182033]">
                  Approval Governance Queue
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  Quotes routed for line-item discount or terms review
                </p>
              </div>
              <Link
                to="/approvals"
                className="text-xs font-semibold text-[#714B67] hover:underline flex items-center gap-1"
              >
                <span>Full Queue ({pendingApprovals.length})</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B7280]">
                <CheckCircle2 className="w-6 h-6 text-[#2E7D32] mx-auto mb-1.5" />
                All quotes are approved or within permitted self-governing limits.
              </div>
            ) : (
              <div className="divide-y divide-[#E4E4E7] mt-1">
                {pendingApprovals.slice(0, 3).map((q) => {
                  const effDiscount =
                    q.subtotal > 0 ? (q.totalDiscount / q.subtotal) * 100 : 0;
                  return (
                    <div
                      key={q.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/quotations/${q.id}`}
                            className="font-bold text-[#714B67] hover:underline"
                          >
                            {q.code}
                          </Link>
                          <span className="text-[#6B7280]">•</span>
                          <span className="font-semibold text-[#182033]">{q.customerName}</span>
                        </div>
                        <div className="text-[11px] text-[#4B5563] mt-0.5">
                          Amount: <strong>{formatCurrency(q.grandTotal || q.totalAmount || 0)}</strong> • Effective
                          Discount: <strong>{effDiscount.toFixed(1)}%</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RiskBadge risk={q.blendedRiskValue} />
                        <Link
                          to={`/approvals/${q.id}`}
                          className="bg-[#FAF5F8] hover:bg-[#F3EDF2] border border-[#E8DCE7] text-[#714B67] font-semibold px-2.5 py-1 rounded text-xs transition-colors"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Deal Insights, Recommendations & Deal Health Alerts */}
        <div className="space-y-6">
          {/* 27. AI DEAL INSIGHT & RECOMMENDATION (Embedded Contextual Intelligence) */}
          <div className="bg-white rounded-lg border border-[#E4E4E7] shadow-2xs p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#182033]">
              <Sparkles className="w-4 h-4 text-[#714B67]" />
              <span>AI Deal Insights & Recommendations</span>
            </div>

            {/* AI Deal Insight Card 1 */}
            <div className="bg-[#FAF5F8] rounded-md p-3 border border-[#E8DCE7] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#714B67]">
                  Deal Health Anomaly
                </span>
                <span className="text-[10px] font-mono text-[#B91C1C] font-semibold bg-[#FEF2F2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                  High Risk
                </span>
              </div>
              <p className="text-xs text-[#182033] font-medium leading-tight">
                Service discount on Q-1042 is 8 points above the permitted tier.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  to="/admin/discount-tiers"
                  className="text-[11px] font-semibold text-[#4B5563] hover:text-[#182033] underline"
                >
                  View Rule
                </Link>
                <span className="text-[#D1D5DB]">•</span>
                <Link
                  to="/approvals/QT-Q1042"
                  className="text-[11px] font-semibold text-[#714B67] hover:underline"
                >
                  Review Deal
                </Link>
              </div>
            </div>

            {/* AI Upsell Recommendation Card */}
            <div className="bg-[#F0FDFA] rounded-md p-3 border border-[#CCFBF1] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  AI Cross-Sell Opportunity
                </span>
                <span className="text-[10px] font-mono text-[#2E7D32] font-semibold bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0]">
                  +₹18,200
                </span>
              </div>
              <p className="text-xs text-[#182033] font-medium leading-tight">
                Recommended: <strong>24/7 SLA Premium Support</strong> for Acme Corporation hardware bundle.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#6B7280]">Expected Margin: +14%</span>
                <Link
                  to="/quotations/QT-Q1042"
                  className="text-[11px] font-semibold text-[#0D9488] hover:underline"
                >
                  Apply to Quote →
                </Link>
              </div>
            </div>
          </div>

          {/* Deal Health Anomaly Triage */}
          <div className="bg-white rounded-lg border border-[#E4E4E7] shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#182033]">
                <ShieldAlert className="w-4 h-4 text-[#B91C1C]" />
                <span>Deal Health Triaging</span>
              </div>
              <Link
                to="/deal-health"
                className="text-xs font-semibold text-[#714B67] hover:underline"
              >
                All Flags
              </Link>
            </div>

            {activeFlags.length === 0 ? (
              <p className="text-xs text-[#6B7280] py-2">No critical deal health anomalies.</p>
            ) : (
              <div className="space-y-2.5">
                {activeFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className="p-2.5 rounded border border-[#E4E4E7] hover:border-[#D1D5DB] transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#182033]">{flag.type}</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1 rounded ${
                          flag.severity === 'Critical'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4B5563] leading-tight">{flag.detail}</p>
                    <div className="text-[10px] text-[#6B7280] pt-0.5">
                      Quote: <strong className="text-[#714B67]">{flag.quotationId}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
