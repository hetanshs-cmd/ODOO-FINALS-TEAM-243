import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { useQuotations } from '../hooks/useQuotations';
import { useCustomers } from '../hooks/useCustomers';
import { useDealHealthAlerts } from '../hooks/useDealHealth';
import { StatusBadge, RiskBadge } from '../components/ui/Badge';
import { formatCurrency, humanizeStatus } from '../utils/formatters';
import { ApiDealAlert, ApiQuotation } from '../services/apiTypes';
import { RiskLevel } from '../types';

// Quotations that are still "in play" — not yet converted, cancelled, or
// closed out one way or another. Matches the enum's own semantics rather
// than an invented business rule.
const OPEN_STATUSES = new Set<ApiQuotation['status']>([
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT_TO_CUSTOMER',
  'NEGOTIATION',
  'ACCEPTED',
]);

const ALERT_TYPE_LABELS: Record<ApiDealAlert['alert_type'], string> = {
  STALLED: 'Stalled Deal',
  DISCOUNT_ANOMALY: 'Discount Anomaly',
  DELIVERY_SLIPPAGE: 'Delivery Slippage',
};

const ALERT_TYPE_ICONS: Record<ApiDealAlert['alert_type'], React.ReactNode> = {
  STALLED: <Clock className="w-3.5 h-3.5 text-amber-600" />,
  DISCOUNT_ANOMALY: <TrendingUp className="w-3.5 h-3.5 text-rose-600" />,
  DELIVERY_SLIPPAGE: <Truck className="w-3.5 h-3.5 text-blue-600" />,
};

/** No per-quotation risk score exists server-side — an open HIGH/CRITICAL
 * deal-health alert is the real signal this dashboard has for "at risk". */
function riskFromAlerts(alerts: ApiDealAlert[]): RiskLevel {
  if (alerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')) return 'HIGH';
  if (alerts.some((a) => a.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

export const DashboardPage: React.FC = () => {
  const { quotations } = useQuotations();
  const { customers } = useCustomers();
  const { alerts } = useDealHealthAlerts();
  const navigate = useNavigate();

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const getCustomerName = (id: string) => customersById.get(id)?.name || 'Unnamed Customer';

  const alertsByQuotation = useMemo(() => {
    const map = new Map<string, ApiDealAlert[]>();
    for (const alert of alerts) {
      const list = map.get(alert.quotation_id) || [];
      list.push(alert);
      map.set(alert.quotation_id, list);
    }
    return map;
  }, [alerts]);

  const pendingApprovals = quotations.filter((q) => q.status === 'PENDING_APPROVAL');
  const openQuotations = quotations.filter((q) => OPEN_STATUSES.has(q.status));
  const atRiskDeals = openQuotations.filter((q) => riskFromAlerts(alertsByQuotation.get(q.id) || []) === 'HIGH');
  const totalPipelineRevenue = openQuotations.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

  const recentQuotations = [...quotations]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const activeFlags = alerts.slice(0, 3);

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
              Deal Health Alert
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">
            Open HIGH/CRITICAL deal-health flags
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
                    const subtotal = Number(q.subtotal || 0);
                    const effDiscount = subtotal > 0 ? (Number(q.discount_total || 0) / subtotal) * 100 : 0;
                    return (
                      <tr
                        key={q.id}
                        onClick={() => navigate(`/quotations/${q.id}`)}
                        className="hover:bg-[#FAF5F8]/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#714B67] group-hover:underline">
                          {q.quotation_number}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#182033] truncate max-w-[150px]">
                          {getCustomerName(q.customer_id)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#182033] text-right">
                          {formatCurrency(Number(q.grand_total || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-[#4B5563]">
                            {effDiscount.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <RiskBadge level={riskFromAlerts(alertsByQuotation.get(q.id) || [])} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={humanizeStatus(q.status)} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-[11px] font-semibold text-[#714B67] group-hover:underline">
                            Open →
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {recentQuotations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 px-3 text-center text-[#6B7280]">
                        No quotations yet.
                      </td>
                    </tr>
                  )}
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
                  const subtotal = Number(q.subtotal || 0);
                  const effDiscount = subtotal > 0 ? (Number(q.discount_total || 0) / subtotal) * 100 : 0;
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
                            {q.quotation_number}
                          </Link>
                          <span className="text-[#6B7280]">•</span>
                          <span className="font-semibold text-[#182033]">{getCustomerName(q.customer_id)}</span>
                        </div>
                        <div className="text-[11px] text-[#4B5563] mt-0.5">
                          Amount: <strong>{formatCurrency(Number(q.grand_total || 0))}</strong> • Effective
                          Discount: <strong>{effDiscount.toFixed(1)}%</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RiskBadge level={riskFromAlerts(alertsByQuotation.get(q.id) || [])} />
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

        {/* RIGHT COLUMN: Deal Health Alerts */}
        <div className="space-y-6">
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
                    onClick={() => navigate(`/quotations/${flag.quotation_id}`)}
                    className="p-2.5 rounded border border-[#E4E4E7] hover:border-[#D1D5DB] transition-colors text-xs space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#182033] flex items-center gap-1.5">
                        {ALERT_TYPE_ICONS[flag.alert_type] || <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                        {ALERT_TYPE_LABELS[flag.alert_type] || flag.alert_type}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1 rounded ${
                          flag.severity === 'CRITICAL' || flag.severity === 'HIGH'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4B5563] leading-tight">{flag.message}</p>
                    <div className="text-[10px] text-[#6B7280] pt-0.5">
                      Quote: <strong className="text-[#714B67]">{flag.quotation_number}</strong>
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
