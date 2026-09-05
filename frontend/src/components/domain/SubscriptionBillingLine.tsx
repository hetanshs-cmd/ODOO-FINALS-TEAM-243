import React from 'react';
import { RefreshCw, Calendar, ArrowRight } from 'lucide-react';
import { BillingCycle, SubscriptionStatus } from '../../types';
import { StatusBadge } from '../ui/Badge';

export interface SubscriptionBillingLineProps {
  productName: string;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  amount: number;
  nextBillDate: string;
  className?: string;
}

export const SubscriptionBillingLine: React.FC<SubscriptionBillingLineProps> = ({
  productName,
  cycle,
  status,
  amount,
  nextBillDate,
  className = '',
}) => {
  return (
    <div
      className={`p-3 bg-white rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{productName}</div>
          <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5">
            <span>Cadence: {cycle}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Next Billing: {nextBillDate}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={status} size="sm" />
        <div className="font-mono font-bold text-slate-900 text-sm">
          ₹{(amount ?? 0).toLocaleString()}/{cycle === 'Monthly' ? 'mo' : 'yr'}
        </div>
      </div>
    </div>
  );
};

export interface ProrationSummaryProps {
  daysInCycle: number;
  daysRemaining: number;
  previousAmount: number;
  newAmount: number;
  proratedAdjustment: number;
  effectiveDate: string;
  className?: string;
}

export const ProrationSummary: React.FC<ProrationSummaryProps> = ({
  daysInCycle,
  daysRemaining,
  previousAmount,
  newAmount,
  proratedAdjustment,
  effectiveDate,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-slate-50 rounded border border-slate-200 text-xs ${className}`}>
      <h4 className="font-semibold text-slate-800 mb-2">Mid-Cycle Proration Calculation</h4>
      <div className="space-y-1.5 text-slate-600 mb-3">
        <div className="flex justify-between">
          <span>Billing Period:</span>
          <span className="font-mono">{daysInCycle} total days ({daysRemaining} days remaining)</span>
        </div>
        <div className="flex justify-between">
          <span>Rate Change:</span>
          <span className="font-mono flex items-center gap-1">
            ₹{previousAmount} <ArrowRight className="w-3 h-3 text-slate-400" /> ₹{newAmount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Effective Date:</span>
          <span className="font-mono">{effectiveDate}</span>
        </div>
      </div>
      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
        <span>Net Immediate Credit / Charge:</span>
        <span className="font-mono text-blue-950">₹{proratedAdjustment.toFixed(2)}</span>
      </div>
    </div>
  );
};
