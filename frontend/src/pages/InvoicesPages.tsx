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
import { useInvoices } from '../hooks/useInvoices';
import { useQuotations } from '../hooks/useQuotations';
import { ApiInvoice, ApiInvoiceStatus } from '../services/apiTypes';

// ============================================================================
// SCREEN 12: INVOICES LIST (FINANCIAL OPERATIONS REGISTER)
// ============================================================================

// The real ApiInvoiceStatus has no dedicated "Credit Note" concept (that was
// a mock-only Invoice.isCreditNote flag) — the CREDIT_NOTES tab is dropped
// in favor of VOID, the closest real status to a cancelled financial record.
type InvoiceStatusFilter = 'ALL' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export const InvoicesListPage: React.FC = () => {
  const { invoices, loading, error } = useInvoices();
  const { quotations } = useQuotations();
  const navigate = useNavigate();

  const quotationsById = useMemo(() => new Map(quotations.map((q) => [q.id, q])), [quotations]);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ONE_TIME' | 'RECURRING'>('ALL');

  // The real API has no per-invoice paid-amount/balance-due field on the
  // list response (that requires GET /invoices/:id/payments per invoice —
  // too expensive for a list page). Approximate: PAID/VOID => no balance,
  // everything else => full total outstanding.
  const getApproxBalance = (inv: ApiInvoice) => {
    const total = parseFloat(inv.total) || 0;
    if (inv.status === 'PAID' || inv.status === 'VOID') return 0;
    return total;
  };

  // Compute list metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalUnpaid = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let voidCount = 0;
    let voidAmount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const inv of invoices) {
      const total = parseFloat(inv.total) || 0;
      const balance = getApproxBalance(inv);

      if (inv.status === 'VOID') {
        voidCount += 1;
        voidAmount += total;
        continue;
      }

      totalInvoiced += total;
      totalPaid += total - balance;
      totalUnpaid += balance;

      const isPastDue = !!inv.due_date && inv.due_date < todayStr && balance > 0;
      if (inv.status === 'OVERDUE' || isPastDue) {
        overdueCount += 1;
      }
    }

    return {
      totalInvoiced,
      totalUnpaid,
      totalPaid,
      overdueCount,
      voidCount,
      voidAmount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const quotation = inv.quotation_id ? quotationsById.get(inv.quotation_id) : undefined;

      // 1. Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesCode = inv.invoice_number?.toLowerCase().includes(q);
        const matchesCustomer = inv.customer_id?.toLowerCase().includes(q);
        const matchesQuote =
          inv.quotation_id?.toLowerCase().includes(q) ||
          quotation?.quotation_number.toLowerCase().includes(q);
        if (!matchesCode && !matchesCustomer && !matchesQuote) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE') {
          const todayStr = new Date().toISOString().split('T')[0];
          const isPastDue = !!inv.due_date && inv.due_date < todayStr && getApproxBalance(inv) > 0;
          if (inv.status !== 'OVERDUE' && !isPastDue) return false;
        } else if (inv.status !== statusFilter) {
          return false;
        }
      }

      // 3. Type filter
      if (typeFilter !== 'ALL' && inv.invoice_type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [invoices, quotationsById, searchQuery, statusFilter, typeFilter]);

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

        {/* The real API has no dedicated Credit Note concept; this card is
            repointed to VOID invoices (the closest real cancelled status). */}
        <div className="bg-white border border-purple-200 rounded p-3.5 shadow-2xs bg-purple-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-purple-700">Void Invoices</span>
            <FileMinus className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-purple-900">
              ${metrics.voidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-purple-700">{metrics.voidCount} voided financial records</div>
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
          </div>
        </div>

        {/* Status Tab Chips */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium mr-1 shrink-0">Status:</span>
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'ISSUED', label: 'Issued' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'VOID', label: 'Void' },
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
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    Loading invoices…
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No matching invoices found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or search terms</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const total = parseFloat(inv.total) || 0;
                  const balanceDue = getApproxBalance(inv);
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = inv.status === 'OVERDUE' || (!!inv.due_date && inv.due_date < todayStr && balanceDue > 0);
                  const quotation = inv.quotation_id ? quotationsById.get(inv.quotation_id) : undefined;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Document Code */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {inv.invoice_type === 'RECURRING' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          <span className="font-mono font-bold text-indigo-900 group-hover:underline">
                            {inv.invoice_number}
                          </span>
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {inv.issued_at ? inv.issued_at.split('T')[0] : inv.created_at.split('T')[0]}
                      </td>

                      {/* Customer — shown by id; no customer-directory lookup in this list page's scope. */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 whitespace-nowrap">
                        {inv.customer_id}
                      </td>

                      {/* Originating Quotation */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {inv.quotation_id ? (
                          <Link
                            to={`/quotations/${inv.quotation_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 hover:text-indigo-600 hover:underline"
                          >
                            <span>{quotation?.quotation_number || inv.quotation_id}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {inv.invoice_type === 'RECURRING' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">
                            Recurring
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            One-Time
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                          {inv.due_date || '—'}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-semibold">
                        <span className="text-slate-900">
                          ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Balance Due — approximated (see getApproxBalance); the
                          real API needs a per-invoice payments fetch for the
                          exact figure. */}
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
              Total Visible: <strong className="text-slate-900">${filteredInvoices.reduce((s, i) => s + (parseFloat(i.total) || 0), 0).toLocaleString()}</strong>
            </span>
            <span>
              Unsettled Balance: <strong className="text-amber-800">${filteredInvoices.reduce((s, i) => s + getApproxBalance(i), 0).toLocaleString()}</strong>
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
  const { invoices, quotations, activeFulfillmentSplits, currentUser, recordPayment } = useDealStore();
  const navigate = useNavigate();

  // Find invoice by ID or Code
  const invoice = useMemo(() => {
    return invoices.find((i) => i.id === id || i.code === id) || null;
  }, [invoices, id]);

  // Originating quotation
  const quotation = useMemo(() => {
    if (!invoice?.quotationId) return null;
    return quotations.find((q) => q.id === invoice.quotationId || q.code === invoice.quotationId) || null;
  }, [quotations, invoice]);

  // Fulfillment state
  const fulfillmentSplit = useMemo(() => {
    if (!invoice?.quotationId) return null;
    return activeFulfillmentSplits[invoice.quotationId] || null;
  }, [activeFulfillmentSplits, invoice]);

  // Active Detail Tab
  const [activeTab, setActiveTab] = useState<'LINES' | 'RECONCILIATION' | 'PAYMENTS' | 'AUDIT'>('LINES');

  // Payment Recording Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Card' | 'Cheque' | 'Wire Transfer' | 'Other'>('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  // PDF Preview Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isEmailSentModalOpen, setIsEmailSentModalOpen] = useState(false);

  // Perform three-way reconciliation calculation
  const reconciliation = useMemo(() => {
    if (!quotation) return null;
    return reconcileDeliveryAndBilling({
      quotation,
      fulfillmentSplit,
      invoice,
      allInvoices: invoices,
    });
  }, [quotation, fulfillmentSplit, invoice, invoices]);

  // Calculate invoice financial totals
  const totals = useMemo(() => {
    if (!invoice) {
      return {
        subtotal: 0,
        discountAmount: 0,
        tax: 0,
        prorationAdjustment: 0,
        creditAmount: 0,
        total: 0,
        paidAmount: 0,
        balanceDue: 0,
      };
    }

    const currentPaid = invoice.paidAmount ?? (invoice.status === 'Paid' ? invoice.amount : 0);

    return calculateInvoiceTotals({
      lines: invoice.lines,
      subtotal: invoice.subtotal ?? invoice.amount,
      discountAmount: invoice.discountAmount ?? 0,
      tax: invoice.tax ?? 0,
      prorationAdjustment: invoice.prorationAdjustment ?? 0,
      creditAmount: invoice.creditAmount ?? 0,
      paidAmount: currentPaid,
    });
  }, [invoice]);

  // Permissions check for payment recording
  const userRole = currentUser?.role || 'sales_rep';
  const effectiveUser: User = currentUser || {
    id: 'usr-guest',
    name: 'Guest User',
    role: userRole as any,
    email: 'guest@dealflow360.internal',
    active: true,
    department: 'Sales',
  };
  const paymentPermission = canUserPerformAction(effectiveUser, 'record_payment');

  // Open payment modal prefilled with balance due
  const handleOpenPaymentModal = () => {
    if (!invoice) return;
    const balance = totals.balanceDue;
    setPaymentAmount(balance);
    setPaymentReference(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentNote(`Clearance payment for ${invoice.code} received from ${invoice.customerName || 'Customer'}.`);
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  // Submit payment handler
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (!paymentPermission.allowed) {
      setPaymentError(paymentPermission.reason || 'You do not have permission to record payments.');
      return;
    }

    if (paymentAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (paymentAmount > totals.balanceDue) {
      setPaymentError(`Payment amount ($${paymentAmount.toLocaleString()}) cannot exceed the outstanding balance of $${totals.balanceDue.toLocaleString()}.`);
      return;
    }

    try {
      recordPayment(invoice.id, {
        amount: paymentAmount,
        paymentDate,
        paymentMethod,
        reference: paymentReference,
        note: paymentNote,
        recordedBy: currentUser?.name || 'Finance Officer',
      });

      setIsPaymentModalOpen(false);
      setPaymentSuccessMessage(`Payment of $${paymentAmount.toLocaleString()} successfully recorded for ${invoice.code}.`);
      setTimeout(() => setPaymentSuccessMessage(null), 5000);
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to record payment.');
    }
  };

  if (!invoice) {
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

  const isCredit = invoice.isCreditNote || invoice.type === 'Credit Note';

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumbs */}
      <PageHeader
        title={`Invoice ${invoice.code}`}
        description={`Commercial invoice issued to ${invoice.customerName || 'Customer'} on ${invoice.issueDate}. Reconciled against quotation ${invoice.quotationCode || invoice.quotationId || 'QT'}.`}
        breadcrumbs={[
          { label: 'Workspace' },
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.code },
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

      {/* Success Notification Banner */}
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

      {/* Odoo ERP Action Bar & Pipeline Ribbon */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {totals.balanceDue > 0 && !isCredit && (
            <div className="relative group">
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenPaymentModal}
                disabled={!paymentPermission.allowed}
                className="font-semibold shadow-xs"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1" />
                Record Payment
              </Button>
              {!paymentPermission.allowed && (
                <div className="absolute left-0 -bottom-8 hidden group-hover:block z-20 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                  {paymentPermission.reason || 'Sales Representatives cannot record payments.'}
                </div>
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            className="text-slate-700 hover:text-slate-900"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print / PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEmailSentModalOpen(true)}
            className="text-slate-700 hover:text-slate-900"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Send by Email
          </Button>

          {quotation && (
            <Link
              to={`/quotations/${quotation.id}`}
              className="inline-flex items-center px-2.5 py-1.5 text-xs text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-400" />
              View Quote {quotation.code}
            </Link>
          )}

          {invoice.subscriptionId && (
            <Link
              to={`/subscriptions/${invoice.subscriptionId}`}
              className="inline-flex items-center px-2.5 py-1.5 text-xs text-cyan-700 border border-cyan-300 bg-cyan-50/50 rounded hover:bg-cyan-100 transition-colors font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-cyan-600" />
              Subscription {invoice.subscriptionCode || invoice.subscriptionId}
            </Link>
          )}
        </div>

        {/* Right Status Progression Pipeline */}
        <div className="flex items-center gap-1 text-[11px] font-medium font-sans">
          <div className={`px-2.5 py-1 rounded-l border border-r-0 ${
            invoice.status === 'Draft'
              ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            Draft
          </div>
          <div className={`px-2.5 py-1 border-y ${
            invoice.status === 'Unpaid' || invoice.status === 'Overdue'
              ? 'bg-amber-600 text-white border-amber-600 font-semibold'
              : invoice.status === 'Paid' || invoice.status === 'Partially Paid'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            Posted / Invoiced
          </div>
          <div className={`px-2.5 py-1 border-y ${
            invoice.status === 'Partially Paid'
              ? 'bg-indigo-700 text-white border-indigo-700 font-semibold'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            Partially Paid
          </div>
          <div className={`px-2.5 py-1 rounded-r border border-l-0 ${
            invoice.status === 'Paid'
              ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            Paid & Settled
          </div>
        </div>
      </div>

      {/* Primary Invoice Document Header Card */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs p-5 space-y-4">
        {/* Document Title & Smart Buttons Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">
                {isCredit ? 'Credit Note' : 'Customer Invoice'} {invoice.code}
              </h1>
              <StatusBadge status={invoice.status} />
              {isCredit && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  CREDIT ADJUSTMENT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Issued for order confirmation and warehouse fulfillment verification.
            </p>
          </div>

          {/* Odoo Smart Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {quotation && (
              <button
                onClick={() => navigate(`/quotations/${quotation.id}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Order Quote</div>
                  <div className="text-xs font-mono font-bold text-slate-900">{quotation.code}</div>
                </div>
              </button>
            )}

            <button
              onClick={() => navigate('/fulfillment')}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Dispatch Stage</div>
                <div className="text-xs font-bold text-slate-900">{invoice.deliveryStage || 'Invoiced'}</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('PAYMENTS')}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-200 hover:border-slate-400 bg-slate-50 text-left transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Payments</div>
                <div className="text-xs font-bold text-slate-900">
                  {invoice.payments?.length || (invoice.status === 'Paid' ? 1 : 0)} Recorded
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 2-Column Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Column 1: Customer & Account Info */}
          <div className="space-y-2.5">
            <div>
              <span className="text-slate-400 font-medium text-[11px] block">Customer</span>
              <span className="font-semibold text-slate-900 text-sm">{invoice.customerName || 'Customer'}</span>
              <span className="text-slate-500 font-mono text-[11px] block">Account ID: {invoice.customerId}</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium text-[11px] block">Originating Quotation</span>
              <span className="font-mono font-medium text-slate-800">
                {invoice.quotationCode || invoice.quotationId || 'Direct Invoice'}
              </span>
            </div>

            {invoice.subscriptionId && (
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Subscription Contract</span>
                <span className="font-mono font-medium text-cyan-800">
                  {invoice.subscriptionCode || invoice.subscriptionId} (Billing Cycle: {invoice.billingPeriodStart || 'Start'} to {invoice.billingPeriodEnd || 'End'})
                </span>
              </div>
            )}
          </div>

          {/* Column 2: Financial Terms & Dates */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Invoice Date</span>
                <span className="font-mono font-semibold text-slate-800">{invoice.issueDate}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Payment Due Date</span>
                <span className={`font-mono font-semibold ${
                  invoice.dueDate < new Date().toISOString().split('T')[0] && totals.balanceDue > 0
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}>
                  {invoice.dueDate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Payment Terms</span>
                <span className="font-medium text-slate-800">Net 45 Days</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Billing Type</span>
                <span className="font-medium text-slate-800">
                  {isCredit ? 'Credit Adjustment' : invoice.isRecurring ? 'Recurring SaaS Cycle' : 'One-Time Delivery Milestone'}
                </span>
              </div>
            </div>

            {invoice.paidAt && (
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Settled At</span>
                <span className="font-mono text-emerald-700 font-semibold">{invoice.paidAt}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Notes / Memo if present */}
        {invoice.notes && (
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 mr-1.5">Operational Note:</span>
            {invoice.notes}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* AUTHORITATIVE 3-WAY RECONCILIATION SECTION: "NOTHING BILLS BEFORE IT SHIPS" */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        {/* Banner Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider font-sans">
                Three-Way Reconciliation: Delivery → Invoicing → Payment
              </h2>
              <p className="text-[11px] text-slate-300 font-mono">
                Fundamental ERP Rule: <strong className="text-amber-300">&quot;Nothing bills before it ships.&quot;</strong>
              </p>
            </div>
          </div>

          {reconciliation && (
            <div className="flex items-center gap-2 text-xs">
              {reconciliation.hasInconsistencies ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" /> Overbilling Inconsistency Detected!
                </span>
              ) : reconciliation.hasPendingShipments ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Reconciled Partial Shipment ({reconciliation.totalPendingPhysicalUnits} backordered units deferred)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified Reconciled
                </span>
              )}
            </div>
          )}
        </div>

        {/* Detailed Reconciliation Table */}
        <div className="p-4 space-y-3">
          {/* Golden Scenario Context Callout (especially for Test 53) */}
          {reconciliation?.hasPhysicalInventory && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Truck className="w-3.5 h-3.5 text-amber-700" />
                Fulfillment Reconciliation Rule Enforced:
              </div>
              <p className="leading-relaxed text-[11px] text-amber-800">
                Physical hardware line items are gated by warehouse dispatch receipts.
                {reconciliation.totalPendingPhysicalUnits > 0 ? (
                  <span>
                    {' '}Of <strong>{reconciliation.totalOrderedPhysicalUnits}</strong> ordered physical units, <strong>{reconciliation.totalShippedPhysicalUnits}</strong> have been verified dispatched and invoiced. The remaining <strong>{reconciliation.totalPendingPhysicalUnits} units</strong> remain on backorder in distribution centers and <strong>cannot be invoiced</strong> until fulfillment split dispatch confirmation.
                  </span>
                ) : (
                  <span>
                    {' '}All ordered physical hardware units have verified delivery completion and are fully billable.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Reconciliation Table */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Product / Line</th>
                  <th className="py-2.5 px-2.5 text-center">Category</th>
                  <th className="py-2.5 px-2.5 text-right">Ordered Qty</th>
                  <th className="py-2.5 px-2.5 text-right">Fulfilled / Shipped</th>
                  <th className="py-2.5 px-2.5 text-right">Invoiced Qty</th>
                  <th className="py-2.5 px-2.5 text-right">Backordered (Deferred)</th>
                  <th className="py-2.5 px-3 text-right">Invoiced ($)</th>
                  <th className="py-2.5 px-3 text-right">Deferred ($)</th>
                  <th className="py-2.5 px-3">Reconciliation Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {reconciliation?.items.map((item, idx) => {
                  const isPhysical = item.category === 'Hardware';
                  return (
                    <tr key={item.productId || idx} className="hover:bg-slate-50/50">
                      {/* Product Name */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.productName}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.category === 'Hardware'
                            ? 'bg-amber-100 text-amber-800'
                            : item.category === 'Subscription'
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {item.category}
                        </span>
                      </td>

                      {/* Ordered Qty */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-medium text-slate-800">
                        {item.orderedQty}
                      </td>

                      {/* Shipped Qty */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-semibold">
                        {isPhysical ? (
                          <span className={item.shippedQty < item.orderedQty ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                            {item.shippedQty}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">N/A (Service)</span>
                        )}
                      </td>

                      {/* Invoiced Qty */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-indigo-950">
                        {item.invoicedQty}
                      </td>

                      {/* Remaining to Ship / Backordered */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-semibold">
                        {isPhysical && item.remainingToShipQty > 0 ? (
                          <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
                            {item.remainingToShipQty} backordered
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Invoiced Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${(item.invoicedQty * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Deferred Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {item.deferredAmount > 0 ? (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                            ${item.deferredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400">$0.00</span>
                        )}
                      </td>

                      {/* Explanation */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs leading-tight">
                        {item.explanation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Tabs Bar */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('LINES')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'LINES'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoice Lines ({invoice.lines?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'PAYMENTS'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Payments & Ledger ({invoice.payments?.length || (invoice.status === 'Paid' ? 1 : 0)})
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'AUDIT'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit Trail & Timeline ({invoice.auditTrail?.length || 0})
        </button>
      </div>

      {/* Tab 1: Itemized Invoice Lines */}
      {activeTab === 'LINES' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3.5">Line Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Invoiced Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Taxes</th>
                  <th className="py-2.5 px-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {invoice.lines && invoice.lines.length > 0 ? (
                  invoice.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-900">{line.description}</div>
                        {line.periodStart && line.periodEnd && (
                          <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                            Period: {line.periodStart} – {line.periodEnd} ({line.cycle || 'monthly'})
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {line.category || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                        {line.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                        ${(line.unitPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {line.tax ? `$${line.tax.toLocaleString()}` : '0%'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                        ${(line.amount ?? (line.quantity * line.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Standard invoice charge for contract {invoice.code} (${invoice.amount.toLocaleString()})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Summary (Right Aligned Accounting Block) */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-2 text-xs font-sans">
              <div className="flex justify-between text-slate-600">
                <span>Untaxed Amount (Subtotal):</span>
                <span className="font-mono font-semibold text-slate-800">
                  ${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Contractual Discount:</span>
                  <span className="font-mono font-semibold">
                    -${totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {totals.prorationAdjustment !== 0 && (
                <div className="flex justify-between text-cyan-700">
                  <span>Proration Adjustment:</span>
                  <span className="font-mono font-semibold">
                    {totals.prorationAdjustment > 0 ? `+$${totals.prorationAdjustment.toLocaleString()}` : `-$${Math.abs(totals.prorationAdjustment).toLocaleString()}`}
                  </span>
                </div>
              )}

              {totals.creditAmount > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Applied Credit Notes:</span>
                  <span className="font-mono font-semibold">
                    -${totals.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Taxes:</span>
                <span className="font-mono text-slate-700">
                  ${totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total:</span>
                <span className="font-mono">
                  ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Paid Amount:</span>
                <span className="font-mono font-semibold">
                  ${totals.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-bold">
                <span className={totals.balanceDue > 0 ? 'text-amber-900' : 'text-emerald-800'}>
                  Amount Due:
                </span>
                <span className={`font-mono ${totals.balanceDue > 0 ? 'text-amber-900' : 'text-emerald-800'}`}>
                  ${totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {totals.balanceDue === 0 && (
                <div className="mt-2 text-center bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-1 rounded text-[11px] tracking-wider uppercase">
                  ✓ PAID IN FULL
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payments & Cash Ledger */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded shadow-2xs p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Payment Clearance History</h3>
                <p className="text-xs text-slate-500">
                  Transactions reconciled against invoice {invoice.code} in the general cash ledger.
                </p>
              </div>
              {totals.balanceDue > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenPaymentModal}
                  disabled={!paymentPermission.allowed}
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  Record New Payment
                </Button>
              )}
            </div>

            {/* Payments Table */}
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference #</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Memo / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {invoice.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-700">{p.paymentDate}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{p.paymentMethod}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{p.reference}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.recordedBy}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{p.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : invoice.status === 'Paid' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">Invoice Paid in Full</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Settled at {invoice.paidAt || invoice.issueDate}. Initial cash clearance completed with matching delivery sign-off.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CreditCard className="w-7 h-7 mx-auto mb-1 text-slate-300" />
                <p className="font-medium text-slate-700">No payment records yet</p>
                <p className="text-[11px]">Outstanding balance is ${totals.balanceDue.toLocaleString()}. Use the button above to record customer clearance.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Audit Trail & Timeline */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded shadow-2xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Governance & Invoicing Audit Log</h3>
            <p className="text-xs text-slate-500">
              Immutable ledger trail verifying billing issuance, fulfillment reconciliation, and payment clearance.
            </p>
          </div>

          <div className="space-y-3">
            {invoice.auditTrail && invoice.auditTrail.length > 0 ? (
              invoice.auditTrail.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-slate-600 shrink-0">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{entry.action}</span>
                      <span className="font-mono text-[10px] text-slate-400">{entry.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Actor: <strong className="text-slate-800">{entry.actor}</strong> {entry.role && `(${entry.role})`}
                    </div>
                    {entry.note && (
                      <p className="text-[11px] text-slate-700 mt-1 leading-relaxed bg-white p-2 rounded border border-slate-100 font-sans">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                Invoice {invoice.code} initialized from approved quotation {invoice.quotationId}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD PAYMENT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Customer Payment: ${invoice.code}`}
        description={`Record receipt of funds from ${invoice.customerName || 'Customer'} to clear outstanding balance.`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRecordPaymentSubmit}
              disabled={!paymentPermission.allowed || paymentAmount <= 0}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Confirm Payment Clearance
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs font-sans">
          {/* Permission warning if user is not authorized */}
          {!paymentPermission.allowed && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{paymentPermission.reason || 'Payment recording requires Finance, Operations, or Admin role.'}</span>
            </div>
          )}

          {paymentError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs">
              {paymentError}
            </div>
          )}

          {/* Balance Overview */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total Invoice Amount</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Current Outstanding Balance</span>
              <span className="font-mono font-bold text-amber-900 text-sm">
                ${totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Payment Amount ($ USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-mono font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={totals.balanceDue}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                required
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Enter full or partial amount</span>
              <button
                type="button"
                onClick={() => setPaymentAmount(totals.balanceDue)}
                className="text-indigo-600 hover:underline font-medium"
              >
                Pay Full Balance (${totals.balanceDue.toLocaleString()})
              </button>
            </div>
          </div>

          {/* Payment Date & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-hidden focus:border-indigo-600"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-hidden focus:border-indigo-600"
              >
                <option value="Bank Transfer">Bank Transfer / Wire</option>
                <option value="Card">Corporate Credit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Wire Transfer">ACH Mandate</option>
                <option value="Other">Other Electronic Clearance</option>
              </select>
            </div>
          </div>

          {/* Reference # */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Transaction / Cheque Reference # *
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. WIRE-998432 or CHQ-00129"
              className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-hidden focus:border-indigo-600"
              required
            />
          </div>

          {/* Internal Note */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Payment Memo / Accounting Notes
            </label>
            <textarea
              rows={2}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Add audit justification or deposit account reference..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-hidden focus:border-indigo-600"
            />
          </div>

          {/* Signoff Actor */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Signing User: <strong className="text-slate-700">{currentUser?.name || 'Current User'}</strong></span>
            <span>Role: <strong className="uppercase text-slate-700">{userRole}</strong></span>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* PRINTABLE / PDF PREVIEW MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Commercial Invoice Document Preview: ${invoice.code}`}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPdfModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print Invoice
            </Button>
          </div>
        }
      >
        <div className="p-6 bg-white border border-slate-200 rounded font-sans text-xs space-y-6">
          {/* Company & Document Header */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">DealFlow360 Enterprise ERP</h2>
              <p className="text-slate-500 text-[11px]">Global Corporate Distribution & Cloud Solutions</p>
              <p className="text-slate-500 text-[11px]">GST / Tax ID: US-DEALFLOW-2026-99</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-mono font-bold text-slate-900">{invoice.code}</h1>
              <p className="text-slate-500 font-mono text-[11px]">Issue Date: {invoice.issueDate}</p>
              <p className="text-slate-500 font-mono text-[11px]">Payment Due: {invoice.dueDate}</p>
            </div>
          </div>

          {/* Billed To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Billed To</span>
              <p className="font-bold text-slate-900 text-sm">{invoice.customerName}</p>
              <p className="text-slate-600 text-[11px]">Customer Account: {invoice.customerId}</p>
              <p className="text-slate-600 text-[11px]">Terms: Net 45 Days</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Order Reference</span>
              <p className="font-mono font-semibold text-slate-800">Quotation: {invoice.quotationCode || invoice.quotationId}</p>
              <p className="text-slate-600 text-[11px]">Delivery Stage: {invoice.deliveryStage || 'Invoiced'}</p>
              <p className="text-slate-600 text-[11px]">Payment Status: <strong className="uppercase">{invoice.status}</strong></p>
            </div>
          </div>

          {/* Printable Lines Table */}
          <table className="w-full text-left border border-slate-200">
            <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-700">
              <tr>
                <th className="p-2">Description</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Unit Price</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines?.map((l) => (
                <tr key={l.id}>
                  <td className="p-2 font-medium text-slate-800">{l.description}</td>
                  <td className="p-2 text-right font-mono">{l.quantity}</td>
                  <td className="p-2 text-right font-mono">${(l.unitPrice ?? 0).toLocaleString()}</td>
                  <td className="p-2 text-right font-mono font-bold">${(l.amount ?? (l.quantity * l.unitPrice)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-1 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">${totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxes:</span>
                <span className="font-mono">${totals.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-300">
                <span>Invoice Total:</span>
                <span className="font-mono">${totals.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Paid Amount:</span>
                <span className="font-mono">${totals.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-900 font-bold text-sm pt-1 border-t border-slate-200">
                <span>Balance Due:</span>
                <span className="font-mono">${totals.balanceDue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* SEND BY EMAIL CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEmailSentModalOpen}
        onClose={() => setIsEmailSentModalOpen(false)}
        title="Send Commercial Invoice by Email"
        description={`Send digital invoice PDF and payment link directly to ${invoice.customerName || 'Customer'}.`}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEmailSentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsEmailSentModalOpen(false);
                setPaymentSuccessMessage(`Invoice ${invoice.code} has been dispatched to accounts payable at ${invoice.customerName || 'Customer'}.`);
                setTimeout(() => setPaymentSuccessMessage(null), 5000);
              }}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Dispatch Email
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Recipient</label>
            <input
              type="email"
              readOnly
              value={`billing@${(invoice.customerName || 'client').toLowerCase().replace(/\s+/g, '')}.com`}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-slate-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              readOnly
              value={`Commercial Invoice ${invoice.code} - ${invoice.customerName || 'Customer'}`}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-sans text-slate-700"
            />
          </div>
          <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded text-[11px]">
            The recipient will receive an official PDF copy along with bank wire instructions and authorized credit card checkout link.
          </div>
        </div>
      </Modal>
    </div>
  );
};
