import React from 'react';
import { AlertCircle, Clock, TrendingUp, Truck, ArrowRight } from 'lucide-react';
import { DealHealthFlag } from '../../types';
import { Button } from '../ui/Button';

export interface DealHealthFlagCardProps {
  flag: DealHealthFlag;
  onOpenDeal?: (quotationId: string) => void;
  onNudgeRep?: (quotationId: string) => void;
  onEscalate?: (quotationId: string) => void;
  className?: string;
}

export const DealHealthFlagCard: React.FC<DealHealthFlagCardProps> = ({
  flag,
  onOpenDeal,
  onNudgeRep,
  onEscalate,
  className = '',
}) => {
  const typeIcons = {
    Stalled: <Clock className="w-4 h-4 text-amber-600" />,
    DiscountAnomaly: <TrendingUp className="w-4 h-4 text-rose-600" />,
    DeliverySlippage: <Truck className="w-4 h-4 text-blue-600" />,
  };

  const severityBadges = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-50 text-amber-800 border-amber-200',
    Critical: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <div className={`p-4 bg-white rounded border border-slate-200 shadow-xs flex flex-col justify-between gap-3 ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {typeIcons[flag.type] || <AlertCircle className="w-4 h-4 text-slate-400" />}
            <span className="text-xs font-bold text-slate-900">
              {flag.type === 'DiscountAnomaly'
                ? 'Discount Anomaly'
                : flag.type === 'DeliverySlippage'
                ? 'Delivery Slippage'
                : 'Stalled Deal'}
            </span>
          </div>
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${severityBadges[flag.severity]}`}>
            {flag.severity}
          </span>
        </div>

        <div className="text-xs text-slate-500 font-mono mb-1.5">
          {flag.quotationCode} • {flag.customerName}
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">{flag.detail}</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
        <span className="text-[10px] text-slate-400">
          Flagged {new Date(flag.flaggedAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1.5">
          {onNudgeRep && (
            <Button variant="ghost" size="sm" onClick={() => onNudgeRep(flag.quotationId)}>
              Nudge Rep
            </Button>
          )}
          {onEscalate && (
            <Button variant="outline" size="sm" onClick={() => onEscalate(flag.quotationId)}>
              Escalate
            </Button>
          )}
          {onOpenDeal && (
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight className="w-3 h-3" />}
              iconPosition="right"
              onClick={() => onOpenDeal(flag.quotationId)}
            >
              Open Deal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
