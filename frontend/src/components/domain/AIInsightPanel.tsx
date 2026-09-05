import React from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';

export interface AIInsightItem {
  id: string;
  category: 'RiskAnalysis' | 'Optimization' | 'GovernanceExplanation';
  title: string;
  summary: string;
  suggestedActionLabel?: string;
  onApplyAction?: () => void;
}

export interface AIInsightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entityTitle: string;
  insights?: AIInsightItem[];
  className?: string;
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  isOpen,
  onClose,
  entityTitle,
  insights = [],
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`p-4 bg-purple-50/70 border border-purple-200 rounded-lg shadow-xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-purple-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-purple-700 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-950">
              DealFlow360 Operational Intelligence
            </h4>
            <span className="text-[11px] text-purple-700">{entityTitle}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-purple-400 hover:text-purple-700 p-1 rounded hover:bg-purple-100 transition-colors"
          aria-label="Close insight panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {insights.length === 0 ? (
          <div className="text-xs text-purple-800 bg-white/60 p-3 rounded border border-purple-100 italic">
            No anomalous risk patterns or optimizations detected. Deal is aligned with governance policies.
          </div>
        ) : (
          insights.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-white rounded border border-purple-100 shadow-2xs flex flex-col justify-between gap-2"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                  {item.category.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.summary}</p>
              </div>
              {item.suggestedActionLabel && item.onApplyAction && (
                <div className="pt-1 flex justify-end">
                  <Button
                    variant="ai"
                    size="sm"
                    icon={<ChevronRight className="w-3 h-3" />}
                    iconPosition="right"
                    onClick={item.onApplyAction}
                  >
                    {item.suggestedActionLabel}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
