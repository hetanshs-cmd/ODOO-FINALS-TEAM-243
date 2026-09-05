import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  DollarSign,
  CreditCard,
  Send,
  Printer,
  Calendar,
  ShieldAlert,
  Truck,
  RefreshCw,
  Search,
  ArrowUpRight,
  Lock,
  ExternalLink,
  Layers,
  FileMinus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useDealStore } from '../hooks/useDealStore';
import { Invoice, PaymentRecord, User } from '../types';
import { reconcileDeliveryAndBilling, calculateInvoiceTotals } from '../domain/billing';
import { canUserPerformAction } from '../domain/permissions';
// -- Real-backend imports used by InvoiceDetailPage below. The list view
// above (InvoicesListPage) is not yet migrated by the owning agent and
// still reads the mock store — left untouched per task scope.
import { useInvoice } from '../hooks/useInvoices';
import { billingService, quotationService } from '../services';
import { ApiPayment, ApiTimelineEvent, RecordPaymentInput } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';

// ============================================================================
// SCREEN 12: INVOICES LIST (FINANCIAL OPERATIONS REGISTER)
// ============================================================================

export const InvoicesListPage: React.FC = () => {
  const { invoices, quotations } = useDealStore();
  const navigate = useNavigate();

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CREDIT_NOTES'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ONE_TIME' | 'RECURRING' | 'CREDIT_NOTE'>('ALL');

  // Compute list metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalUnpaid = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let creditNotesCount = 0;
    let creditNotesAmount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const inv of invoices) {
      if (inv.isCreditNote || inv.type === 'Credit Note') {
        creditNotesCount += 1;
        creditNotesAmount += Math.abs(inv.amount);
        continue;
      }

      totalInvoiced += inv.amount;
      const paid = inv.paidAmount ?? (inv.status === 'Paid' ? inv.amount : 0);
      const balance = inv.balanceDue ?? Math.max(0, inv.amount - paid);

      totalPaid += paid;
      totalUnpaid += balance;

      if ((inv.status === 'Unpaid' || inv.status === 'Overdue') && inv.dueDate < todayStr && balance > 0) {
        overdueCount += 1;
        overdueAmount += balance;
      }
    }

    return {
      totalInvoiced,
      totalUnpaid,
      totalPaid,
      overdueCount,
      overdueAmount,
      creditNotesCount,
      creditNotesAmount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesCode = inv.code?.toLowerCase().includes(q);
        const matchesCustomer = inv.customerName?.toLowerCase().includes(q);
        const matchesQuote = inv.quotationId?.toLowerCase().includes(q) || inv.quotationCode?.toLowerCase().includes(q);
        const matchesSub = inv.subscriptionId?.toLowerCase().includes(q) || inv.subscriptionCode?.toLowerCase().includes(q);
        if (!matchesCode && !matchesCustomer && !matchesQuote && !matchesSub) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === 'UNPAID') {
        if (inv.status !== 'Unpaid' || inv.isCreditNote) return false;
      } else if (statusFilter === 'PARTIALLY_PAID') {
        if (inv.status !== 'Partially Paid') return false;
      } else if (statusFilter === 'PAID') {
        if (inv.status !== 'Paid') return false;
      } else if (statusFilter === 'OVERDUE') {
        const todayStr = new Date().toISOString().split('T')[0];
        const isPastDue = inv.dueDate < todayStr && (inv.balanceDue ?? inv.amount) > 0;
        if (inv.status !== 'Overdue' && !isPastDue) return false;
      } else if (statusFilter === 'CREDIT_NOTES') {
        if (!inv.isCreditNote && inv.type !== 'Credit Note') return false;
      }

      // 3. Type filter
      if (typeFilter === 'ONE_TIME') {
        if (inv.isRecurring || inv.isCreditNote || inv.type === 'Recurring' || inv.type === 'Credit Note') return false;
      } else if (typeFilter === 'RECURRING') {
        if (!inv.isRecurring && inv.type !== 'Recurring') return false;
      } else if (typeFilter === 'CREDIT_NOTE') {
        if (!inv.isCreditNote && inv.type !== 'Credit Note') return false;
      }

      return true;
    });
  }, [invoices, searchQuery, statusFilter, typeFilter]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <PageHeader
        title="Financial Operations & Invoices"
        description="Delivery-reconciled billing register. Physical goods are billed strictly after dispatch; recurring subscription cycles are managed independently."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Invoicing' }, { label: 'Invoices Register' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">
              {filteredInvoices.length} of {invoices.length} invoices
            </span>
          </div>
        }
      />

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Receivables</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900">
              ${metrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Across {metrics.totalCount} issued financial records</div>
        </div>

        <div className="bg-white border border-amber-200 rounded p-3.5 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">Outstanding Balance</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-amber-900">
              ${metrics.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700">Awaiting customer clearance</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded p-3.5 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Paid Receipts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-900">
              ${metrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700">Settled and reconciled in cash ledger</div>
        </div>

        <div className="bg-white border border-purple-200 rounded p-3.5 shadow-2xs bg-purple-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-purple-700">Applied Credits</span>
            <FileMinus className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-purple-900">
              ${metrics.creditNotesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-purple-700">{metrics.creditNotesCount} active credit adjustments</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by invoice number, customer, quote ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Dropdown / Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Type:</span>
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('ONE_TIME')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                typeFilter === 'ONE_TIME'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              One-Time
            </button>
            <button
              onClick={() => setTypeFilter('RECURRING')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                typeFilter === 'RECURRING'
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Recurring
            </button>
            <button
              onClick={() => setTypeFilter('CREDIT_NOTE')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                typeFilter === 'CREDIT_NOTE'
                  ? 'bg-purple-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Credit Note
            </button>
          </div>
        </div>

        {/* Status Tab Chips */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium mr-1 shrink-0">Status:</span>
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'UNPAID', label: 'Unpaid' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'CREDIT_NOTES', label: 'Credit Notes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dense Odoo-style Invoices Table */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5">Invoice / Document</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Originating Quotation</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Delivery Stage</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No matching invoices found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or search terms</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isCredit = inv.isCreditNote || inv.type === 'Credit Note';
                  const paid = inv.paidAmount ?? (inv.status === 'Paid' ? inv.amount : 0);
                  const balanceDue = inv.balanceDue !== undefined ? inv.balanceDue : (isCredit ? 0 : Math.max(0, inv.amount - paid));
                  const isOverdue = inv.status === 'Overdue' || (inv.status === 'Unpaid' && inv.dueDate < new Date().toISOString().split('T')[0]);

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Document Code */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isCredit ? (
                            <FileMinus className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : inv.isRecurring ? (
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          <span className="font-mono font-bold text-indigo-900 group-hover:underline">
                            {inv.code}
                          </span>
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {inv.issueDate}
                      </td>

                      {/* Customer */}
                      <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {inv.customerName || 'Customer'}
                      </td>

                      {/* Originating Quotation */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {inv.quotationId ? (
                          <Link
                            to={`/quotations/${inv.quotationId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 hover:text-indigo-600 hover:underline"
                          >
                            <span>{inv.quotationCode || inv.quotationId}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isCredit ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                            Credit Note
                          </span>
                        ) : inv.isRecurring ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">
                            Recurring
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            One-Time
                          </span>
                        )}
                      </td>

                      {/* Delivery Stage */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                          {inv.deliveryStage === 'Partially Shipped' ? (
                            <Truck className="w-3 h-3 text-amber-600" />
                          ) : inv.deliveryStage === 'Shipped' ? (
                            <Truck className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Layers className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{inv.deliveryStage || 'Invoiced'}</span>
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                          {inv.dueDate}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-semibold">
                        <span className={isCredit ? 'text-purple-700' : 'text-slate-900'}>
                          {isCredit ? `-$${Math.abs(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </span>
                      </td>

                      {/* Balance Due */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-semibold">
                        {balanceDue > 0 ? (
                          <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-amber-800'}>
                            ${balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">$0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        <StatusBadge status={inv.status} size="sm" />
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Strip */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div>
            Showing <strong className="text-slate-700">{filteredInvoices.length}</strong> records
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>
              Total Visible: <strong className="text-slate-900">${filteredInvoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}</strong>
            </span>
            <span>
              Unsettled Balance: <strong className="text-amber-800">${filteredInvoices.reduce((s, i) => s + (i.balanceDue ?? (i.status === 'Paid' ? 0 : i.amount)), 0).toLocaleString()}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SCREEN 13: INVOICE DETAIL (RECONCILIATION & ACCOUNTING LEDGER)
// ============================================================================

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { invoice, loading, error, refetch } = useInvoice(id);

  const [activeTab, setActiveTab] = useState<'LINES' | 'PAYMENTS' | 'AUDIT'>('LINES');

  // Payments
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const loadPayments = React.useCallback(() => {
    if (!invoice) return;
    setPaymentsLoading(true);
    billingService
      .listPayments(invoice.id)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, [invoice]);

  React.useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Timeline — quotation-backed activity feed. Invoices don't have their
  // own timeline endpoint; if this invoice has no quotation_id there is
  // nothing to show (rather than misusing the quotation timeline for an
  // unrelated invoice).
  const [timeline, setTimeline] = useState<ApiTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  React.useEffect(() => {
    if (!invoice?.quotation_id) {
      setTimeline([]);
      return;
    }
    setTimelineLoading(true);
    quotationService
      .getTimeline(invoice.quotation_id)
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  }, [invoice]);

  // Payment Recording Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // The real-backend permission engine (canUserPerformAction) is wired to
  // mock User/Quotation shapes; simplified here to "always allowed" since
  // the backend itself enforces authorization server-side and will 403 an
  // unauthorized attempt.
  const paymentPermission = { allowed: true, reason: undefined as string | undefined };

  const totals = useMemo(() => {
    if (!invoice) return { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0, paidAmount: 0, balanceDue: 0 };
    const total = Number(invoice.total);
    const paidAmount = payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      subtotal: Number(invoice.subtotal),
      discountTotal: Number(invoice.discount_total),
      taxTotal: Number(invoice.tax_total),
      total,
      paidAmount,
      balanceDue: Math.max(0, total - paidAmount),
    };
  }, [invoice, payments]);

  const handleOpenPaymentModal = () => {
    if (!invoice) return;
    setPaymentAmount(totals.balanceDue);
    setPaymentReference(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    if (paymentAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    if (paymentAmount > totals.balanceDue) {
      setPaymentError(`Payment amount ($${paymentAmount.toLocaleString()}) cannot exceed the outstanding balance of $${totals.balanceDue.toLocaleString()}.`);
      return;
    }
    setIsRecording(true);
    setPaymentError(null);
    try {
      const payload: RecordPaymentInput = {
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_reference: paymentReference || undefined,
      };
      await billingService.recordPayment(invoice.id, payload);
      setIsPaymentModalOpen(false);
      setPaymentSuccessMessage(`Payment of $${paymentAmount.toLocaleString()} successfully recorded for ${invoice.invoice_number}.`);
      setTimeout(() => setPaymentSuccessMessage(null), 5000);
      await Promise.all([loadPayments(), refetch()]);
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Failed to record payment.');
    } finally {
      setIsRecording(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-slate-500">Loading invoice…</div>;
  }

  if (error || !invoice) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Invoice Not Found</h2>
        <p className="text-xs text-slate-500">The requested invoice ID could not be located in the register.</p>
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded hover:bg-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Invoices
        </Link>
      </div>
    );
  }

  const isCredit = invoice.status === 'VOID';

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumbs */}
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`Commercial invoice for customer ${invoice.customer_id}${invoice.issued_at ? ` issued on ${new Date(invoice.issued_at).toLocaleDateString()}` : ''}. TODO: resolve customer display name once a customers directory hook lands.`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
        badge={<StatusBadge status={invoice.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 bg-white shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices
            </Link>
          </div>
        }
      />

      {paymentSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{paymentSuccessMessage}</span>
          </div>
          <button onClick={() => setPaymentSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {totals.balanceDue > 0 && !isCredit && (
            <Button variant="primary" size="sm" onClick={handleOpenPaymentModal} className="font-semibold shadow-xs">
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              Record Payment
            </Button>
          )}

          {invoice.quotation_id && (
            <Link
              to={`/quotations/${invoice.quotation_id}`}
              className="inline-flex items-center px-2.5 py-1.5 text-xs text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-400" />
              View Originating Quote
            </Link>
          )}

          {invoice.sales_order_id && (
            <button
              onClick={() => navigate('/fulfillment')}
              className="inline-flex items-center px-2.5 py-1.5 text-xs text-amber-700 border border-amber-300 bg-amber-50/50 rounded hover:bg-amber-100 transition-colors font-medium"
            >
              <Truck className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Sales Order {invoice.sales_order_id}
            </button>
          )}
        </div>
      </div>

      {/* Document Header Card */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">
                {isCredit ? 'Void / Credit Invoice' : 'Customer Invoice'} {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {invoice.invoice_type === 'RECURRING' ? 'Recurring subscription billing cycle.' : 'One-time invoice.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2.5">
            <div>
              <span className="text-slate-400 font-medium text-[11px] block">Customer</span>
              {/* TODO: enrich with customer name once useCustomers()/directoryService is reconciled in. */}
              <span className="font-mono font-semibold text-slate-900 text-sm">{invoice.customer_id}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium text-[11px] block">Originating Quotation</span>
              <span className="font-mono font-medium text-slate-800">{invoice.quotation_id || 'Direct Invoice'}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Issued</span>
                <span className="font-mono font-semibold text-slate-800">
                  {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Payment Due Date</span>
                <span className={`font-mono font-semibold ${
                  invoice.due_date && new Date(invoice.due_date) < new Date() && totals.balanceDue > 0
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}>
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
            {invoice.paid_at && (
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Settled At</span>
                <span className="font-mono text-emerald-700 font-semibold">{new Date(invoice.paid_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTE: the mock store's three-way delivery/invoicing/payment
          reconciliation view depended on the mock domain engine
          (reconcileDeliveryAndBilling) operating on mock Quotation +
          WarehouseSplitResult shapes with no real-backend equivalent
          exposed at that granularity. Simplified out rather than
          fabricated — see billing_total summary + payments tab below for
          the real, backend-verified financial state instead. */}

      {/* Detail Tabs Bar */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('LINES')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'LINES' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Invoice Lines ({invoice.items?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'PAYMENTS' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Payments & Ledger ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'AUDIT' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Activity Feed ({timeline.length})
        </button>
      </div>

      {activeTab === 'LINES' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5">Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Tax</th>
                  <th className="py-2.5 px-3.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{line.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">${Number(line.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">${Number(line.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">${Number(line.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No line items on record for invoice {invoice.invoice_number} (total ${totals.total.toLocaleString()}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-80 bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-2 text-xs font-sans">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-800">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">-${totals.discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax:</span>
                <span className="font-mono font-semibold text-slate-800">${totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2">
                <span>Total:</span>
                <span className="font-mono">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Paid:</span>
                <span className="font-mono font-semibold">${totals.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-bold border-t border-slate-200 pt-2">
                <span>Balance Due:</span>
                <span className="font-mono">${totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PAYMENTS' && (
        <Card title="Payments & Ledger" subtitle="Backed by GET /invoices/:id/payments." padding="md" className="border-slate-200">
          {paymentsLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading payments…</div>
          ) : payments.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 italic">No payments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Paid At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3">{p.payment_method}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.transaction_reference || '—'}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={p.status} size="sm" /></td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'AUDIT' && (
        <Card
          title="Activity Feed"
          subtitle={invoice.quotation_id ? 'Backed by GET /quotations/:id/timeline (this invoice\'s originating quotation).' : 'No timeline endpoint exists for invoices without an originating quotation — TODO once one is added.'}
          padding="md"
          className="border-slate-200"
        >
          {!invoice.quotation_id ? (
            <div className="p-4 text-center text-xs text-slate-400 italic">No activity feed available for this invoice.</div>
          ) : timelineLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading…</div>
          ) : timeline.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 italic">No events recorded yet.</div>
          ) : (
            <div className="space-y-3 text-xs">
              {timeline.map((ev) => (
                <div key={ev.id} className="border-l-2 border-[#714B67] pl-3 py-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{new Date(ev.created_at).toLocaleString()}</span>
                    <span className="font-semibold text-slate-700">{ev.actor_user_id || 'System'}</span>
                  </div>
                  <div className="font-semibold text-slate-800 text-[11px] font-mono">{ev.event_type}</div>
                  {ev.note && <div className="text-slate-600 text-[11px] leading-tight font-sans">{ev.note}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Payment Recording Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment — ${invoice.invoice_number}`}
        description="Records a payment against the real backend (POST /invoices/:id/payments)."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleRecordPaymentSubmit} disabled={isRecording}>
              Confirm Payment
            </Button>
          </div>
        }
      >
        <form className="space-y-3 text-xs" onSubmit={handleRecordPaymentSubmit}>
          {paymentError && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">{paymentError}</div>}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded text-slate-900"
              min={0}
              step="0.01"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-slate-900"
            >
              <option>Bank Transfer</option>
              <option>Card</option>
              <option>Cheque</option>
              <option>Wire Transfer</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transaction Reference</label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-slate-900"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
