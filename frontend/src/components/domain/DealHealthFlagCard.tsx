import React from 'react';
import { AlertCircle, Clock, TrendingUp, Truck, ArrowRight } from 'lucide-react';
import { ApiDealAlert } from '../../services/apiTypes';
import { Button } from '../ui/Button';

export interface DealHealthFlagCardProps {
  flag: ApiDealAlert;
  /** Resolved by the caller when it already has the customer directory loaded. */
  customerName?: string;
  onOpenDeal?: (quotationId: string) => void;
  onNudgeRep?: (alertId: string) => void;
  onEscalate?: (alertId: string) => void;
  className?: string;
}

const TYPE_ICONS: Record<ApiDealAlert['alert_type'], React.ReactNode> = {
  STALLED: <Clock className="w-4 h-4 text-amber-600" />,
  DISCOUNT_ANOMALY: <TrendingUp className="w-4 h-4 text-rose-600" />,
  DELIVERY_SLIPPAGE: <Truck className="w-4 h-4 text-blue-600" />,
};

const TYPE_LABELS: Record<ApiDealAlert['alert_type'], string> = {
  STALLED: 'Stalled Deal',
  DISCOUNT_ANOMALY: 'Discount Anomaly',
  DELIVERY_SLIPPAGE: 'Delivery Slippage',
};

const SEVERITY_BADGES: Record<ApiDealAlert['severity'], string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-800 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-800 border-rose-200',
};

export const DealHealthFlagCard: React.FC<DealHealthFlagCardProps> = ({
  flag,
  customerName,
  onOpenDeal,
  onNudgeRep,
  onEscalate,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-white rounded border border-slate-200 shadow-xs flex flex-col justify-between gap-3 ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[flag.alert_type] || <AlertCircle className="w-4 h-4 text-slate-400" />}
            <span className="text-xs font-bold text-slate-900">
              {TYPE_LABELS[flag.alert_type] || flag.alert_type}
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
              SEVERITY_BADGES[flag.severity] || SEVERITY_BADGES.LOW
            }`}
          >
            {flag.severity}
          </span>
        </div>

        <div className="text-xs text-slate-500 font-mono mb-1.5">
          {customerName ? `${flag.quotation_number} • ${customerName}` : flag.quotation_number}
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">{flag.message}</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
        <span className="text-[10px] text-slate-400">
          Flagged {new Date(flag.created_at).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1.5">
          {onNudgeRep && (
            <Button variant="ghost" size="sm" onClick={() => onNudgeRep(flag.id)}>
              Nudge Rep
            </Button>
          )}
          {onEscalate && (
            <Button variant="outline" size="sm" onClick={() => onEscalate(flag.id)}>
              Escalate
            </Button>
          )}
          {onOpenDeal && (
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight className="w-3 h-3" />}
              iconPosition="right"
              onClick={() => onOpenDeal(flag.quotation_id)}
            >
              Open Deal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
