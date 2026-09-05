import React, { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useDealHealthAlerts } from '../hooks/useDealHealth';
import { dealHealthService } from '../services';
import { ApiError } from '../services/httpClient';
import { DealHealthFlagCard } from '../components/domain/DealHealthFlagCard';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/Toast';

export const DealHealthPage: React.FC = () => {
  const { alerts, loading, error, refetch } = useDealHealthAlerts();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const navigate = useNavigate();

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
        description="Proactive detection of stalled negotiations, rep discount deviations, and delivery fulfillment slippage."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Deal Health' }]}
      />

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
            />
          ))}
        </div>
      )}
    </div>
  );
};
