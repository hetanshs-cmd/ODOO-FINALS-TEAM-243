import React, { useState, useMemo } from 'react';
import { AlertTriangle, FileText, Check, X, ShieldAlert } from 'lucide-react';
import { Subscription, User, CancellationRefundPolicy } from '../../types';
import { calculateCancellationRefund } from '../../domain/billing';
import { canUserPerformAction } from '../../domain/permissions';

export interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  currentUser: User;
  onConfirm: (options: {
    reason: string;
    effectiveDate: string;
    refundPolicy: CancellationRefundPolicy;
  }) => void;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  subscription,
  currentUser,
  onConfirm,
}) => {
  const [refundPolicy, setRefundPolicy] = useState<CancellationRefundPolicy>('prorated_credit');
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<string>('Contract termination requested by customer');

  // RBAC Permission Check
  const authCheck = useMemo(() => {
    return canUserPerformAction(currentUser, 'cancel_subscription');
  }, [currentUser]);

  // Live refund preview using core domain billing function
  const recurringAmount = subscription.amount ?? ((subscription.quantity || 1) * (subscription.unitRecurringPrice || 0));

  const refund = useMemo(() => {
    return calculateCancellationRefund({
      recurringAmount,
      periodStartDate: subscription.startDate || '2026-09-01',
      periodEndDate: subscription.nextBillDate || '2026-10-01',
      cancellationDate: effectiveDate,
      policy: refundPolicy,
    });
  }, [recurringAmount, subscription.startDate, subscription.nextBillDate, effectiveDate, refundPolicy]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCheck.allowed) return;

    onConfirm({
      reason,
      effectiveDate,
      refundPolicy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-rose-100 text-rose-800 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cancel Recurring Subscription & Credit Ledger
              </h3>
              <p className="text-xs text-rose-800 font-mono">
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* RBAC Warning Banner if Unauthorized */}
          {!authCheck.allowed && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-xs text-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Authorization Denied</span>
                <span>
                  {authCheck.reason ||
                    'Subscription cancellations and credit note generation require Finance, Operations, or Admin authorization.'}
                </span>
                <span className="block mt-1 text-[11px] text-rose-700 font-medium">
                  Logged in as: <strong>{currentUser.name}</strong> ({currentUser.role})
                </span>
              </div>
            </div>
          )}

          {/* Refund Policy Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Settlement & Credit Note Policy
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-2.5 border rounded cursor-pointer transition-colors hover:bg-slate-50 text-xs border-slate-300">
                <input
                  type="radio"
                  name="refundPolicy"
                  value="prorated_credit"
                  checked={refundPolicy === 'prorated_credit'}
                  onChange={() => setRefundPolicy('prorated_credit')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-900">
                    Prorated Credit Note (Enterprise Default)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Calculates linear credit for unused days remaining in current cycle and automatically issues a customer credit note.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 border rounded cursor-pointer transition-colors hover:bg-slate-50 text-xs border-slate-300">
                <input
                  type="radio"
                  name="refundPolicy"
                  value="full_credit"
                  checked={refundPolicy === 'full_credit'}
                  onChange={() => setRefundPolicy('full_credit')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-900">Full Period Credit</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Credits 100% of the recurring invoice ($
                    {recurringAmount.toLocaleString()}).
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 border rounded cursor-pointer transition-colors hover:bg-slate-50 text-xs border-slate-300">
                <input
                  type="radio"
                  name="refundPolicy"
                  value="no_refund"
                  checked={refundPolicy === 'no_refund'}
                  onChange={() => setRefundPolicy('no_refund')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-900">No Refund / Terminal Runout</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cancels auto-renewal at period boundary without issuing financial credit.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Cancellation Effective Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Effective Cancellation Date
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-rose-600"
            />
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Official Cancellation Reason (Recorded to Audit Trail)
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Client migrating infrastructure to internal platform"
              className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-rose-600"
            />
          </div>

          {/* Refund Calculation & Credit Note Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Credit Note Simulation
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {refund.unusedDays} days unused of {refund.totalDays}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-y border-slate-200">
              <span className="text-slate-600">Calculated Refundable Amount:</span>
              <span className="font-mono font-bold text-base text-rose-700">
                ${refund.creditAmount.toFixed(2)}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              {refund.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!authCheck.allowed}
              className={`px-5 py-2 text-xs font-bold text-white rounded shadow-xs transition-colors flex items-center gap-1.5 ${
                authCheck.allowed
                  ? 'bg-rose-700 hover:bg-rose-800'
                  : 'bg-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              Confirm Cancellation & Generate Credit Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
