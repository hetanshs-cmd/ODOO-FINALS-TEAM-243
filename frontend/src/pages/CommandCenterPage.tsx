import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Search,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  FileText,
  Package,
  Repeat,
  RotateCw,
  HelpCircle,
  ExternalLink,
  Layers,
  Send,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { aiService } from '../services/ai/aiService';
import { AIResult, AIAction } from '../services/ai/types';
import { AIInsightPanel } from '../components/ai/AIInsightPanel';
import { toast } from '../components/ui/Toast';

export const CommandCenterPage: React.FC = () => {
  const { quotations, approvalSteps, dealHealthFlags, customers, users, logTimelineEvent } =
    useDealStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeResult, setActiveResult] = useState<AIResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const starterPrompts = [
    'Which deals need my attention today?',
    'Which quotations are waiting on Finance?',
    'Which customers have high-risk discount exceptions?',
    'Show backordered orders with delivery risk.',
    'Which subscriptions have billing changes this month?',
    'Show stalled negotiations with no activity.',
  ];

  const handleRunQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setQuery(queryText);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await aiService.answerWorkspaceQuestion(
        {
          query: queryText,
          quotations,
          approvalSteps,
          dealHealthFlags,
          customers,
          users,
          userRole: user.role,
        },
        queryText
      );
      setActiveResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to query workspace state.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: AIAction) => {
    if (action.type === 'navigate' && action.payload?.path) {
      navigate(action.payload.path);
    } else {
      toast.info('AI Action Selected', `${action.label}`);
    }
  };

  return (
    <div id="command-center-container" className="space-y-5">
      {/* Header */}
      <PageHeader
        title="AI Command Center"
        description="Workspace-aware contextual intelligence across quotations, approval queues, fulfillment risks, and billing cadences."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Command Center' }]}
      />

      {/* Query Search Bar Card */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs p-4 sm:p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery(query);
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Ask DealFlow360
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              • Contextual Intelligence Layer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="command-center-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask an operational question (e.g. Which deals are waiting on Finance?)"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-600 focus:outline-hidden font-medium text-slate-900 bg-[#F9FAFB] focus:bg-white transition-colors"
              />
            </div>

            <button
              id="command-center-submit"
              type="submit"
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#714B67] hover:bg-[#5e3d55] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </div>
        </form>

        {/* Clickable Starter Queries */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500">Suggested Workspace Queries:</div>
          <div className="flex flex-wrap gap-1.5">
            {starterPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                id={`starter-query-${idx}`}
                onClick={() => handleRunQuery(prompt)}
                className="text-[11px] px-2.5 py-1 bg-slate-50 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-200 rounded transition-all cursor-pointer text-left"
              >
                • {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Answer Area */}
      {isLoading && (
        <div className="p-6 bg-white border border-indigo-200 rounded-lg shadow-2xs space-y-3 animate-pulse">
          <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            <span>Consulting DealFlow360 operational ledger...</span>
          </div>
          <div className="h-3 bg-indigo-100/60 rounded w-1/2" />
          <div className="h-2.5 bg-slate-100 rounded w-3/4" />
          <div className="h-2.5 bg-slate-100 rounded w-2/3" />
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>AI Assistance Temporarily Unavailable</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            {errorMessage} Your core operational workflows and deterministic business rules remain completely unaffected.
          </p>
          <button
            type="button"
            onClick={() => handleRunQuery(query)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry Query</span>
          </button>
        </div>
      )}

      {activeResult && !isLoading && !errorMessage && (
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Operational Answer
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-bold uppercase">
                AI-Generated
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Grounded in active workspace state
            </span>
          </div>

          <div className="text-xs font-semibold text-slate-900 leading-snug">
            {activeResult.summary}
          </div>

          {activeResult.bullets && activeResult.bullets.length > 0 && (
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-md border border-slate-200">
              {activeResult.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-600 font-bold mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {activeResult.suggestedActions && activeResult.suggestedActions.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Direct Entity Links & Suggested Navigation:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeResult.suggestedActions.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleActionClick(act)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EEF3] hover:bg-[#E8DCE7] text-[#714B67] border border-[#E8DCE7] font-semibold rounded text-xs transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>{act.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeResult.sourceRefs && (
            <div className="text-[10px] text-slate-400 font-mono pt-1">
              Source Ledger: {activeResult.sourceRefs.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Domain Grounding Notice */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          DealFlow360 AI is strictly workspace-grounded and does not hallucinate fictional records. Governance rules, approvals, and order records are preserved as canonical source truth.
        </span>
      </div>
    </div>
  );
};
