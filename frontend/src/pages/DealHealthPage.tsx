import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useDealHealthAlerts } from '../hooks/useDealHealth';
import { dealHealthService } from '../services';
import { ApiError } from '../services/httpClient';
import { DealHealthFlagCard } from '../components/domain/DealHealthFlagCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/Toast';
import { aiService } from '../services/ai/aiService';
import { AIResult } from '../services/ai/types';
import { AIInsightPanel } from '../components/ai/AIInsightPanel';
import { AIDraftEditorModal } from '../components/ai/AIDraftEditorModal';

export const DealHealthPage: React.FC = () => {
  const { alerts, loading, error, refetch } = useDealHealthAlerts();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const navigate = useNavigate();

  // AI Insights — real local-model-backed calls, grounded in the live open
  // alert list via backend/src/modules/ai.
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftingAlertId, setDraftingAlertId] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const handleSummarize = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiService.getInsight('summarize_deal_health');
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : 'The local AI model is unavailable. It may not be running.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDraftNudge = async (alertId: string) => {
    setDraftingAlertId(alertId);
    setAiError(null);
    try {
      const result = await aiService.getInsight('draft_nudge', alertId);
      setAiResult(result);
      setShowDraftModal(true);
    } catch (err) {
      toast.error('AI unavailable', err instanceof ApiError ? err.message : 'The local AI model is unavailable.');
    } finally {
      setDraftingAlertId(null);
    }
  };

  const handleOpenDeal = (quotationId: string) => {
    navigate(`/quotations/${quotationId}`);
  };

  const actOnAlert = async (alertId: string, status: 'NUDGED' | 'ESCALATED') => {
    setActingOn(alertId);
    try {
      await dealHealthService.actOnAlert(alertId, status);
      if (status === 'NUDGED') {
        toast.info('Rep Nudged', 'The assigned rep has been alerted on this deal.');
      } else {
        toast.warning('Deal Escalated', 'Governance review requested for this deal.');
      }
      await refetch();
    } catch (err) {
      toast.error(
        'Action Failed',
        err instanceof ApiError ? err.message : 'Could not update this alert. Try again.'
      );
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Health & Anomaly Dashboard"
        description="Proactive detection of stalled negotiations, rep discount deviations, and delivery fulfillment slippage — backed by GET /deal-health."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Deal Health' }]}
        actions={
          <Button variant="outline" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} isLoading={aiLoading} onClick={handleSummarize}>
            AI Summary
          </Button>
        }
      />

      {(aiResult || aiLoading || aiError) && (
        <AIInsightPanel
          result={aiResult}
          isLoading={aiLoading}
          loadingMessage="Consulting the local AI model…"
          errorMessage={aiError}
          onRetry={handleSummarize}
        />
      )}

      {showDraftModal && aiResult?.summary && (
        <AIDraftEditorModal
          isOpen={showDraftModal}
          onClose={() => setShowDraftModal(false)}
          title="Draft Nudge Message"
          initialBody={aiResult.summary}
          actionButtonLabel="Copy Draft"
          onApplyOrSend={(body) => {
            navigator.clipboard?.writeText(body).catch(() => undefined);
            toast.success('Draft copied', 'Send it via your usual channel — this does not notify the rep itself.');
            setShowDraftModal(false);
          }}
        />
      )}

      {loading && (
        <Card padding="lg">
          <p className="text-xs text-slate-500">Loading open deal alerts…</p>
        </Card>
      )}

      {!loading && error && (
        <Card padding="lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-rose-700">{error.message}</p>
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-medium text-[#714B67] hover:text-[#62415A] cursor-pointer"
            >
              Try again
            </button>
          </div>
        </Card>
      )}

      {!loading && !error && alerts.length === 0 && (
        <Card padding="lg">
          <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
            No open deal health alerts. Stalled negotiations, discount anomalies, and delivery
            slippage will appear here as they are detected.
          </p>
        </Card>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <DealHealthFlagCard
              key={alert.id}
              flag={alert}
              onOpenDeal={handleOpenDeal}
              onNudgeRep={actingOn ? undefined : (id) => actOnAlert(id, 'NUDGED')}
              onEscalate={actingOn ? undefined : (id) => actOnAlert(id, 'ESCALATED')}
              onDraftNudge={draftingAlertId ? undefined : handleDraftNudge}
            />
          ))}
        </div>
      )}
    </div>
  );
};
