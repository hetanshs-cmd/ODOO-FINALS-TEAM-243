import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { DealHealthFlagCard } from '../components/domain/DealHealthFlagCard';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/Toast';
import { dealHealthService } from '../services';
import { ApiDealAlert } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';
import { DealHealthFlag } from '../types';

// DealHealthFlagCard is a presentational component typed against the mock
// DealHealthFlag shape (narrow `type`/`severity` unions, quotationCode,
// customerName). Rather than fork the component, adapt the real
// ApiDealAlert into that shape here — best-effort normalization of the
// backend's free-form alert_type/severity strings into the 3 UI buckets.
function adaptAlert(alert: ApiDealAlert): DealHealthFlag {
  const typeUpper = (alert.alert_type || '').toUpperCase();
  const type: DealHealthFlag['type'] = typeUpper.includes('DISCOUNT')
    ? 'DiscountAnomaly'
    : typeUpper.includes('DELIVERY') || typeUpper.includes('FULFILL')
    ? 'DeliverySlippage'
    : 'Stalled';

  const severityUpper = (alert.severity || '').toUpperCase();
  const severity: DealHealthFlag['severity'] = severityUpper.includes('CRIT') || severityUpper.includes('HIGH')
    ? 'Critical'
    : severityUpper.includes('MED')
    ? 'Medium'
    : 'Low';

  return {
    id: alert.id,
    type,
    severity,
    quotationId: alert.quotation_id,
    // TODO: resolve the human-readable quotation code / customer name once
    // a customers directory hook lands — shown raw for now rather than
    // fabricated.
    quotationCode: alert.quotation_id,
    customerName: 'Customer lookup pending',
    detail: alert.message,
  } as DealHealthFlag;
}

export const DealHealthPage: React.FC = () => {
  const [alerts, setAlerts] = useState<ApiDealAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadAlerts = () => {
    setLoading(true);
    setError(null);
    dealHealthService
      .listAlerts()
      .then(setAlerts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load deal health alerts.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleOpenDeal = (quotationId: string) => {
    navigate(`/quotations/${quotationId}`);
  };

  const handleNudgeRep = async (quotationId: string) => {
    const alert = alerts.find((a) => a.quotation_id === quotationId);
    if (!alert) return;
    try {
      await dealHealthService.actOnAlert(alert.id, 'NUDGED');
      toast.info('Rep Nudged', `Automated alert dispatched for deal ${quotationId}.`);
      loadAlerts();
    } catch (err) {
      toast.error('Failed to nudge rep', err instanceof ApiError ? err.message : 'Unknown error.');
    }
  };

  const handleEscalate = async (quotationId: string) => {
    const alert = alerts.find((a) => a.quotation_id === quotationId);
    if (!alert) return;
    try {
      await dealHealthService.actOnAlert(alert.id, 'ESCALATED');
      toast.warning('Deal Escalated', `Governance review requested for ${quotationId}.`);
      loadAlerts();
    } catch (err) {
      toast.error('Failed to escalate', err instanceof ApiError ? err.message : 'Unknown error.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Health & Anomaly Dashboard"
        description="Proactive detection of stalled negotiations, rep discount deviations, and delivery fulfillment slippage — backed by GET /deal-health."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Deal Health' }]}
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading deal health alerts…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <DealHealthFlagCard
              key={alert.id}
              flag={adaptAlert(alert)}
              onOpenDeal={handleOpenDeal}
              onNudgeRep={handleNudgeRep}
              onEscalate={handleEscalate}
            />
          ))}
          {alerts.length === 0 && (
            <div className="col-span-full p-8 text-center text-xs text-slate-400 italic">
              No active deal health alerts.
            </div>
          )}
        </div>
      )}

      <Card title="Deal Health Anomaly Triage" padding="lg">
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
          Deal health alerts are now loaded from the real backend (GET /deal-health), with Nudge/Escalate
          actions calling POST /deal-health/:id with the corresponding status. Interactive type/severity
          filters (Stalled, Discount Anomaly, Delivery Slippage) remain a follow-up.
        </p>
      </Card>
    </div>
  );
};
