import React from 'react';
import { CheckCircle2, Clock, XCircle, RotateCcw, ArrowRight, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';
import { ApprovalRole, ApprovalStep } from '../../types';
import { formatRelativeTime, formatExactDateTime } from '../../utils/formatters';

export interface ApprovalChainTimelineProps {
  chain: ApprovalRole[];
  currentRole?: ApprovalRole;
  steps?: ApprovalStep[];
  activePass?: number;
  className?: string;
}

export const ApprovalChainTimeline: React.FC<ApprovalChainTimelineProps> = ({
  chain,
  currentRole,
  steps = [],
  activePass,
  className = '',
}) => {
  const roleLabels: Record<string, string> = {
    sales_manager: 'Sales Manager Review',
    finance: 'Finance Director Sign-Off',
    SalesManager: 'Sales Manager Review',
    Finance: 'Finance Director Sign-Off',
  };

  const defaultAssignees: Record<string, string> = {
    sales_manager: 'David Vance (VP Commercial)',
    finance: 'Elena Rostova (Finance Dir)',
    SalesManager: 'David Vance (VP Commercial)',
    Finance: 'Elena Rostova (Finance Dir)',
  };

  // Group steps by pass if multiple passes exist
  const passes = Array.from(new Set(steps.map((s) => s.pass || 1))).sort((a, b) => a - b);
  const currentPassNum = activePass || (passes.length > 0 ? Math.max(...passes) : 1);

  // Filter steps for the current active pass
  const activePassSteps = steps.filter((s) => (s.pass || 1) === currentPassNum);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* If previous passes exist, show pass indicator */}
      {passes.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 pb-1 border-b border-slate-100">
          <span className="font-semibold text-slate-700">Governance Review Cycles:</span>
          {passes.map((p) => (
            <span
              key={p}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                p === currentPassNum
                  ? 'bg-purple-50 text-purple-800 border-purple-200 font-bold'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              Pass {p} {p < currentPassNum ? '(Returned)' : '(Current)'}
            </span>
          ))}
        </div>
      )}

      {/* Main Chain Steps */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
        {chain.map((role, idx) => {
          const normalizedRole = role.toLowerCase().replace('_', '');
          const matchingStep = activePassSteps.find(
            (s) =>
              (s.approverRole && s.approverRole.toLowerCase().replace('_', '') === normalizedRole) ||
              ((s as { role?: string }).role && (s as { role?: string }).role?.toLowerCase().replace('_', '') === normalizedRole)
          );

          const stepStatus = matchingStep?.status || (matchingStep?.action ? matchingStep.action : undefined);

          const isApproved = stepStatus === 'Approved';
          const isReturned = stepStatus === 'Returned' || matchingStep?.action === 'ReturnedForRevision';
          const isRejected = stepStatus === 'Rejected';
          const isWaiting = stepStatus === 'Waiting' || (!isApproved && !isReturned && !isRejected && idx > 0 && !activePassSteps[idx - 1]?.action?.includes('Approv'));
          const isPending =
            stepStatus === 'Pending' ||
            (currentRole &&
              currentRole.toLowerCase().replace('_', '') === normalizedRole &&
              !isApproved &&
              !isReturned &&
              !isRejected &&
              !isWaiting);

          const reviewerName = matchingStep?.actorName || matchingStep?.user || defaultAssignees[role] || role;

          return (
            <React.Fragment key={`${role}-${idx}`}>
              <div
                className={`flex-1 p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                  isApproved
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                    : isReturned
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs'
                    : isRejected
                    ? 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-2xs'
                    : isPending
                    ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-200 text-blue-950 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Step {idx + 1} of {chain.length}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isReturned
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : isRejected
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : isPending
                          ? 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      {isApproved
                        ? 'Approved'
                        : isReturned
                        ? 'Returned'
                        : isRejected
                        ? 'Rejected'
                        : isPending
                        ? 'Pending Review'
                        : 'Waiting'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {isApproved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isReturned ? (
                        <RotateCcw className="w-4 h-4 text-amber-600" />
                      ) : isRejected ? (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      ) : isPending ? (
                        <Clock className="w-4 h-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400 font-bold">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-snug">
                        {roleLabels[role] || role}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 font-medium">
                        <UserCheck className="w-3 h-3 text-slate-400" />
                        <span>{reviewerName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Note or Sequence Info */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 text-[11px]">
                  {isApproved ? (
                    <div className="text-emerald-800 space-y-0.5">
                      <div className="italic font-medium">&quot;{matchingStep?.note || 'Approved by reviewer.'}&quot;</div>
                      {matchingStep?.date && (
                        <div className="text-[10px] text-emerald-700 opacity-80">
                          {formatRelativeTime(matchingStep.date)} ({formatExactDateTime(matchingStep.date)})
                        </div>
                      )}
                    </div>
                  ) : isReturned ? (
                    <div className="text-amber-800 space-y-0.5">
                      <div className="font-semibold text-[11px]">Feedback:</div>
                      <div className="italic font-medium">&quot;{matchingStep?.note || 'Returned for terms revision.'}&quot;</div>
                      {matchingStep?.date && (
                        <div className="text-[10px] text-amber-700 opacity-80">
                          {formatRelativeTime(matchingStep.date)}
                        </div>
                      )}
                    </div>
                  ) : isRejected ? (
                    <div className="text-rose-800 space-y-0.5">
                      <div className="font-semibold text-[11px]">Rejection Reason:</div>
                      <div className="italic font-medium">&quot;{matchingStep?.note || 'Unacceptable deal terms.'}&quot;</div>
                      {matchingStep?.date && (
                        <div className="text-[10px] text-rose-700 opacity-80">
                          {formatRelativeTime(matchingStep.date)}
                        </div>
                      )}
                    </div>
                  ) : isPending ? (
                    <div className="text-blue-900 font-medium flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>Action required by {roleLabels[role]} reviewer</span>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-[11px]">
                      {idx > 0
                        ? `Locked until Step ${idx} (${chain[idx - 1] === 'sales_manager' ? 'Sales Manager' : chain[idx - 1]}) is approved`
                        : 'Awaiting submission'}
                    </div>
                  )}
                </div>
              </div>

              {idx < chain.length - 1 && (
                <div className="hidden sm:flex items-center justify-center shrink-0 self-center text-slate-300">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
