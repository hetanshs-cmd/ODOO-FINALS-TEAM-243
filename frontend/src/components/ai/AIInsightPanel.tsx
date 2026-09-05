import React from 'react';
import {
  Sparkles,
  AlertCircle,
  RotateCw,
  Clock,
  ArrowRight,
  Check,
  Info,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { AIResult, AIAction } from '../../services/ai/types';

interface AIInsightPanelProps {
  title?: string;
  result: AIResult | null;
  isLoading?: boolean;
  loadingMessage?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  onActionClick?: (action: AIAction) => void;
  className?: string;
  stale?: boolean;
  compact?: boolean;
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  title = 'AI Assist',
  result,
  isLoading = false,
  loadingMessage = 'Analyzing deal...',
  errorMessage = null,
  onRetry,
  onRefresh,
  onActionClick,
  className = '',
  stale = false,
  compact = false,
}) => {
  // 1. Error State
  if (errorMessage) {
    return (
      <div
        id="ai-error-state"
        className={`p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-2.5 ${className}`}
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>AI Assistance Temporarily Unavailable</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {errorMessage || 'AI assistance is temporarily unavailable.'} Your DealFlow360 workflow and business rules are completely unaffected.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded text-[11px] transition-colors cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Loading State
  if (isLoading) {
    return (
      <div
        id="ai-loading-state"
        className={`p-4 bg-indigo-50/40 border border-indigo-200 rounded-lg text-xs space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900 font-semibold">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            <span>{loadingMessage}</span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
            Processing
          </span>
        </div>
        <div className="space-y-1.5 animate-pulse">
          <div className="h-2.5 bg-indigo-200/60 rounded w-3/4" />
          <div className="h-2 bg-indigo-100 rounded w-full" />
          <div className="h-2 bg-indigo-100 rounded w-5/6" />
        </div>
      </div>
    );
  }

  // 3. Empty State (No result generated yet)
  if (!result) {
    return null;
  }

  const isStale = stale || result.stale;

  return (
    <div
      id="ai-insight-panel"
      className={`bg-indigo-50/30 border border-indigo-200/80 rounded-lg text-xs space-y-3 overflow-hidden shadow-2xs ${
        compact ? 'p-3' : 'p-3.5'
      } ${className}`}
    >
      {/* Header with AI Badge & Stale Warning */}
      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-bold text-indigo-950 tracking-tight">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {result.confidence && (
            <span className="text-[10px] bg-white border border-indigo-200 text-indigo-800 font-mono font-medium px-1.5 py-0.2 rounded">
              {result.confidence.toUpperCase()} CONFIDENCE
            </span>
          )}
          <span className="text-[10px] bg-indigo-100/80 text-indigo-900 px-1.5 py-0.2 rounded font-bold tracking-wider uppercase">
            AI-generated
          </span>
        </div>
      </div>

      {/* Stale Warning Banner (Section 62) */}
      {isStale && (
        <div
          id="ai-stale-banner"
          className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center justify-between gap-2"
        >
          <span>This AI summary was generated before the latest quotation changes.</span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 hover:bg-amber-100 font-semibold rounded text-[10px] text-amber-800 cursor-pointer"
            >
              <RotateCw className="w-2.5 h-2.5" />
              <span>Refresh Summary</span>
            </button>
          )}
        </div>
      )}

      {/* Summary Text */}
      {result.summary && (
        <div className="font-semibold text-indigo-950 text-xs leading-snug">
          {result.summary}
        </div>
      )}

      {/* Bullet Points */}
      {result.bullets && result.bullets.length > 0 && (
        <ul className="space-y-1.5 text-slate-700 text-[11.5px] leading-relaxed">
          {result.bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-indigo-600 font-bold mt-0.5 shrink-0">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Rationale / Draft Preview Box */}
      {result.rationale && (
        <div className="p-2.5 bg-white border border-indigo-100 rounded text-[11px] font-mono text-slate-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
          {result.rationale}
        </div>
      )}

      {/* Actionable Suggestions (Section 13, 14, 46) */}
      {result.suggestedActions && result.suggestedActions.length > 0 && (
        <div className="pt-2 border-t border-indigo-100 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">
            Suggested Actions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestedActions.map((act) => (
              <button
                key={act.id}
                type="button"
                id={`btn-ai-action-${act.id}`}
                onClick={() => onActionClick?.(act)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 font-semibold rounded text-[11px] shadow-2xs transition-colors cursor-pointer"
              >
                <span>{act.label}</span>
                <ArrowRight className="w-3 h-3 text-indigo-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source References */}
      {result.sourceRefs && result.sourceRefs.length > 0 && (
        <div className="pt-1 text-[10px] text-slate-400 font-mono">
          Sources: {result.sourceRefs.join(' • ')}
        </div>
      )}
    </div>
  );
};
