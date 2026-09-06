import React, { useState, useMemo } from 'react';
import { RefreshCw, ArrowRight, Calendar, AlertCircle, Check, Info, X } from 'lucide-react';
import { Subscription, SubscriptionPlan, ProrationRule } from '../../types';
import { calculateProration } from '../../domain/billing';

export interface ProrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  plans: SubscriptionPlan[];
  onConfirm: (updates: {
    newPlanId: string;
    newQuantity: number;
    effectiveDate: string;
    prorationRule: 'daily_linear' | 'full_month';
    reason: string;
  }) => void;
}

export const ProrationModal: React.FC<ProrationModalProps> = ({
  isOpen,
  onClose,
  subscription,
  plans,
  onConfirm,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(subscription.planId);
  const [quantity, setQuantity] = useState<number>(subscription.quantity || 1);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [prorationRule, setProrationRule] = useState<'daily_linear' | 'full_month'>('daily_linear');
  const [reason, setReason] = useState<string>('Mid-cycle contract expansion & plan tier upgrade');

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);
  const targetPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId]
  );

  const previousRecurringAmount = subscription.amount ?? ((subscription.quantity || 1) * (subscription.unitRecurringPrice || 0));
  const newUnitRecurringPrice = targetPlan ? targetPlan.price : subscription.unitRecurringPrice;
  const newTotalRecurringAmount = quantity * newUnitRecurringPrice;

  // Real-time calculation using core domain billing function
  const proration = useMemo(() => {
    return calculateProration({
      previousPlanName: subscription.planName,
      previousQuantity: subscription.quantity,
      previousRecurringAmount,
      newPlanName: targetPlan?.name || subscription.planName,
      newQuantity: quantity,
      newRecurringAmount: newTotalRecurringAmount,
      periodStartDate: subscription.startDate || '2026-09-01',
      periodEndDate: subscription.nextBillDate || '2026-10-01',
      effectiveDate,
      rule: prorationRule,
      cycle: subscription.cycle || 'monthly',
    });
  }, [
    subscription.planName,
    subscription.quantity,
    subscription.startDate,
    subscription.nextBillDate,
    subscription.cycle,
    previousRecurringAmount,
    targetPlan,
    quantity,
    newTotalRecurringAmount,
    effectiveDate,
    prorationRule,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      newPlanId: selectedPlanId,
      newQuantity: Number(quantity),
      effectiveDate,
      prorationRule,
      reason,
    });
    onClose();
  };

  const isUpgrade = newTotalRecurringAmount > previousRecurringAmount;
  const isDowngrade = newTotalRecurringAmount < previousRecurringAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Mid-Cycle Plan Modification & Proration Engine
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Subscription: {subscription.code} • {subscription.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Plan & Quantity Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Subscription Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (₹{p.price.toLocaleString()}/{p.cycle === 'yearly' ? 'yr' : 'mo'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                License / Seat Quantity
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs font-mono font-medium border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Dates & Rule Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Effective Modification Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Enterprise Proration Model
              </label>
              <select
                value={prorationRule}
                onChange={(e) => setProrationRule(e.target.value as 'daily_linear' | 'full_month')}
                className="w-full text-xs font-medium border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                <option value="daily_linear">Daily Linear (Standard Enterprise Default)</option>
                <option value="full_month">Full Month (Calendar Boundary Billing)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Contract Amendment Justification
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Enterprise scale-up mid-month requested by customer"
              className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Live Mathematical Proration Breakdown */}
          <div className="border border-blue-200 bg-blue-50/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-700" />
                Live Proration Calculation ({proration.ruleApplied})
              </span>
              <span className="font-mono text-xs text-blue-800 font-semibold">
                {proration.remainingDays} of {proration.totalDaysInPeriod} days remaining
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-white rounded-md p-3 border border-blue-100">
              <div>
                <span className="text-slate-500 text-[11px] block">Current Recurring Charge:</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  ₹{previousRecurringAmount.toLocaleString()}/mo
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {subscription.quantity}x {subscription.planName}
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">New Recurring Charge:</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  ₹{newTotalRecurringAmount.toLocaleString()}/mo
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {quantity}x {targetPlan?.name}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Credit for unused portion of current period:</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  -₹{proration.creditAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Prorated charge for new tier ({proration.remainingDays} days):</span>
                <span className="font-mono text-slate-900 font-semibold">
                  +₹{proration.proratedCharge.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-blue-200 flex justify-between items-center text-sm font-bold">
                <span className="text-blue-950">
                  {isUpgrade
                    ? 'Net Immediate Charge:'
                    : isDowngrade
                    ? 'Net Customer Credit Balance:'
                    : 'Net Adjustment:'}
                </span>
                <span
                  className={`font-mono font-bold text-base ${
                    proration.netAdjustment >= 0 ? 'text-blue-950' : 'text-emerald-700'
                  }`}
                >
                  {proration.netAdjustment >= 0 ? '+' : ''}$
                  {proration.netAdjustment.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic mt-1">
              {proration.description}
            </p>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Commit Plan Change & Apply Proration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
