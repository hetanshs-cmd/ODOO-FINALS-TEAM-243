import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useDealStore } from '../hooks/useDealStore';
import { DealHealthFlagCard } from '../components/domain/DealHealthFlagCard';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/Toast';

export const DealHealthPage: React.FC = () => {
  const { dealHealthFlags } = useDealStore();
  const navigate = useNavigate();

  const handleOpenDeal = (quotationId: string) => {
    navigate(`/quotations/${quotationId}`);
  };

  const handleNudgeRep = (quotationId: string) => {
    toast.info('Rep Nudged', `Automated alert dispatched for deal ${quotationId}.`);
  };

  const handleEscalate = (quotationId: string) => {
    toast.warning('Deal Escalated', `Governance review requested for ${quotationId}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Health & Anomaly Dashboard"
        description="Proactive detection of stalled negotiations, rep discount deviations, and delivery fulfillment slippage."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Deal Health' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dealHealthFlags.map((flag) => (
          <DealHealthFlagCard
            key={flag.id}
            flag={flag}
            onOpenDeal={handleOpenDeal}
            onNudgeRep={handleNudgeRep}
            onEscalate={handleEscalate}
          />
        ))}
      </div>

      <Card title="Deal Health Anomaly Triage (Screen 14 Placeholder)" padding="lg">
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
          Deal health flags loaded from shared store state. Full interactive anomaly filters (Stalled, Discount Anomaly, Delivery Slippage) and direct operational triage actions will be implemented in the Deal Health feature prompt.
        </p>
      </Card>
    </div>
  );
};
