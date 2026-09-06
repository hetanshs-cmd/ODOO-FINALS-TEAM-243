import React from 'react';
import { Calendar, DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Subscription, Invoice } from '../../types';
import { generateBillingSchedule } from '../../domain/billing';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';

export interface BillingScheduleTableProps {
  subscription: Subscription;
  invoices: Invoice[];
  onRecordPayment?: (invoiceId: string) => void;
  className?: string;
}

export const BillingScheduleTable: React.FC<BillingScheduleTableProps> = ({
  subscription,
  invoices,
  onRecordPayment,
  className = '',
}) => {
  const recurringAmount = subscription.amount ?? ((subscription.quantity || 1) * (subscription.unitRecurringPrice || 0));

  // Generate 6 upcoming recurring billing schedule items
  const schedule = generateBillingSchedule({
    subscriptionId: subscription.id,
    startDate: subscription.startDate || '2026-09-01',
    recurringAmount,
    cycle: subscription.cycle || 'monthly',
    count: 6,
  });

  // Filter existing invoices for this quotation or customer
  const relatedInvoices = invoices.filter(
    (i) =>
      i.quotationId === subscription.quotationId ||
      (subscription.quotationCode && i.quotationId === subscription.quotationCode) ||
      i.customerId === subscription.customerId
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Historical & Active Invoices */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-bold text-slate-900">Contract Invoices & Payment Ledger</span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {relatedInvoices.length} invoice record(s)
            </span>
          </div>
        }
        padding="none"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Invoice Code</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Issue Date</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {relatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-blue-900">{inv.code}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-medium text-slate-600">
                      {inv.isRecurring ? 'Recurring Plan' : 'One-Time Order'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{inv.issueDate || '—'}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{inv.dueDate}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{(inv.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={inv.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.status !== 'Paid' && onRecordPayment ? (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(inv.id)}
                        className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-2.5 py-1 transition-colors"
                      >
                        Record Payment
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {relatedInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-slate-500 italic">
                    No billing invoice records generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Projected Upcoming Billing Schedule */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-bold text-slate-900">
              Projected Automated Billing Schedule (Next 6 Cycles)
            </span>
          </div>
        }
        padding="none"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 text-center">Cycle #</th>
                <th className="py-2.5 px-4">Period Window</th>
                <th className="py-2.5 px-4">Target Invoice Date</th>
                <th className="py-2.5 px-4">Target Due Date</th>
                <th className="py-2.5 px-4 text-right">Projected Charge</th>
                <th className="py-2.5 px-4 text-center">Execution State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {schedule.map((entry) => (
                <tr key={entry.cycleNumber} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                    #{entry.cycleNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {entry.periodStartDate} <span className="text-slate-400">to</span> {entry.periodEndDate}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {entry.invoiceDate}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{entry.dueDate}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                    ₹{entry.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3 text-slate-400" /> Scheduled Auto-Debit
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
