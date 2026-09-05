import React from 'react';
import { Sparkles, ArrowUpRight, Check } from 'lucide-react';
import { UpsellSuggestion } from '../../types';
import { Button } from '../ui/Button';

export interface UpsellSuggestionCardProps {
  suggestion: UpsellSuggestion;
  onAccept: (suggestion: UpsellSuggestion) => void;
  isAccepted?: boolean;
  className?: string;
}

export const UpsellSuggestionCard: React.FC<UpsellSuggestionCardProps> = ({
  suggestion,
  onAccept,
  isAccepted = false,
  className = '',
}) => {
  return (
    <div
      className={`p-3.5 rounded border transition-all flex flex-col justify-between gap-3 ${
        isAccepted
          ? 'bg-emerald-50/60 border-emerald-300'
          : 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span className="text-xs font-bold text-slate-900">{suggestion.productName}</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono">
            +{suggestion.marginDelta}% Margin
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{suggestion.reason}</p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-purple-100">
        <span className="text-[11px] text-purple-800 font-medium">
          {suggestion.targetCategory} Add-on
        </span>
        <Button
          variant={isAccepted ? 'secondary' : 'ai'}
          size="sm"
          disabled={isAccepted}
          icon={isAccepted ? <Check className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          onClick={() => onAccept(suggestion)}
        >
          {isAccepted ? 'Accepted' : 'Accept Upsell'}
        </Button>
      </div>
    </div>
  );
};
