import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useDealStore } from '../hooks/useDealStore';
import { DealHealthFlagCard } from '../components/domain/DealHealthFlagCard';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

export const DealHealthPage: React.FC = () => {
  const { dealHealthFlags } = useDealStore();
  const navigate = useNavigate();

  const handleOpenDeal = (quotationId: string) => {
    navigate(`/quotations/${quotationId}`);
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
          />
        ))}
      </div>

      <Card title="Review flagged deals" padding="lg">
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
          Open a deal to review the issue and its history. Notifications and escalation are not available from this preview.
        </p>
      </Card>
    </div>
  );
};
