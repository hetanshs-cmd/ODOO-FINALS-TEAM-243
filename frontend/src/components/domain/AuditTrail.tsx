import React from 'react';
import { DealEvent } from '../../types';
import { Timeline, TimelineItem } from '../ui/Timeline';

export interface AuditTrailProps {
  events: DealEvent[];
  className?: string;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ events, className = '' }) => {
  const items: TimelineItem[] = events.map((e) => ({
    id: e.id,
    title: e.type.replace(/_/g, ' '),
    description: e.description,
    user: e.user,
    timestamp:
      e.timestamp && !isNaN(new Date(e.timestamp).getTime())
        ? new Date(e.timestamp).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Recently',
    status: e.type.includes('REJECT')
      ? 'failed'
      : e.type.includes('APPROV')
      ? 'complete'
      : 'current',
  }));

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded border border-slate-200">
        No audit events recorded for this transaction yet.
      </div>
    );
  }

  return (
    <div className={`bg-white p-4 rounded border border-slate-200 ${className}`}>
      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
        Governance Audit Log
      </h4>
      <Timeline items={items} />
    </div>
  );
};
