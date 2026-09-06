import React from 'react';
import { Package, Wrench, RefreshCw, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { Quotation, WarehouseSplitResult } from '../../types';
import { getHybridBillingSummary } from '../../domain/billing';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';

export interface HybridBillingBreakdownProps {
  quotation: Quotation;
  fulfillmentSplit?: WarehouseSplitResult;
  className?: string;
}

export const HybridBillingBreakdown: React.FC<HybridBillingBreakdownProps> = ({
  quotation,
  fulfillmentSplit,
  className = '',
}) => {
  const summary = getHybridBillingSummary(quotation.lines, fulfillmentSplit);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-700" />
            Hardware & Physical
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            ₹{summary.physicalTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary.physicalLines.length} line item(s) • Split fulfillment
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-blue-700" />
            Services & Deployment
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            ₹{summary.servicesTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 100% Milestone Invoicable
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            Invoicable Today
          </div>
          <div className="text-xl font-bold font-mono text-emerald-950">
            ₹{summary.immediatelyInvoicableTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-800 mt-1">
            Fulfilled items + services cleared
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 mb-1 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
            Recurring Cloud MRR
          </div>
          <div className="text-xl font-bold font-mono text-blue-950">
            ₹{summary.recurringMRR.toLocaleString()}
            <span className="text-xs font-normal text-blue-700">/mo</span>
          </div>
          <div className="text-[11px] text-blue-800 mt-1">
            ARR: ₹{(summary.recurringMRR * 12).toLocaleString()} • Isolated cadence
          </div>
        </div>
      </div>

      {/* Breakdown Tables */}
      <div className="space-y-4">
        {/* Physical Products Table */}
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-bold text-slate-900">Physical Goods & Hardware Ledger</span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-500">
                Invoice Rule: Eligible upon verified warehouse dispatch
              </span>
            </div>
          }
          padding="none"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Item & Specification</th>
                  <th className="py-2.5 px-4 text-center">Ordered Qty</th>
                  <th className="py-2.5 px-4 text-center">Fulfillment Status</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Line Total</th>
                  <th className="py-2.5 px-4 text-right">Invoicable Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.physicalLines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{line.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500">ID: {line.productId}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                      {line.quantity}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {line.isFullyFulfilled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Fully Fulfilled ({line.quantityFulfilled}/{line.quantity})
                        </span>
                      ) : line.isPartiallyFulfilled ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3" /> Partial ({line.quantityFulfilled} Shipped / {line.backorderQuantity} Backordered)
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Dispatched from Mumbai DC</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Awaiting Allocation
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ₹{line.unitPrice.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{line.lineTotal.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-700">
                        ₹{line.invoicableAmount.toLocaleString()}
                      </div>
                      {line.deferredAmount > 0 && (
                        <div className="font-mono text-[10px] text-amber-700">
                          (₹{line.deferredAmount.toLocaleString()} deferred)
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Services & Subscription Split Cards in 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Services Section */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-bold text-slate-900">Services & Enablement (Immediate)</span>
              </div>
            }
            padding="none"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-right">Invoicable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.serviceLines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{line.productName}</div>
                        <div className="text-[11px] text-emerald-700">100% cleared upon contract signature</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{line.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        ₹{line.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        ₹{line.lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {summary.serviceLines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500 italic">
                        No service or professional training items in quotation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Subscription Section */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-bold text-slate-900">Software & Subscriptions (Recurring)</span>
              </div>
            }
            padding="none"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Recurring Service</th>
                    <th className="py-2.5 px-4 text-center">Cadence</th>
                    <th className="py-2.5 px-4 text-right">Recurring Rate</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.recurringLines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{line.productName}</div>
                        <div className="text-[11px] text-slate-500">{line.quantity} active seat(s) / instance</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold uppercase tracking-wider text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {line.recurringCycle || 'Monthly'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{line.unitPrice.toLocaleString()}/mo
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Separated
                        </span>
                      </td>
                    </tr>
                  ))}
                  {summary.recurringLines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500 italic">
                        No recurring subscription services in quotation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
