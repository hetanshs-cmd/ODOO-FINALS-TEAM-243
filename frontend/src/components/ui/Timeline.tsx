import React from 'react';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  status?: 'complete' | 'current' | 'pending' | 'failed';
  icon?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  const statusColors = {
    complete: 'bg-emerald-600 ring-4 ring-emerald-50 text-white',
    current: 'bg-blue-800 ring-4 ring-blue-50 text-white',
    pending: 'bg-slate-300 ring-4 ring-slate-100 text-slate-600',
    failed: 'bg-rose-600 ring-4 ring-rose-50 text-white',
  };

  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 ${className}`}>
      {items.map((item) => {
        const status = item.status || 'complete';
        return (
          <div key={item.id} className="relative group">
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${statusColors[status]}`}
            >
              {item.icon || '•'}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.timestamp}</span>
              </div>
              {item.description && <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>}
              {item.user && <span className="text-[11px] font-medium text-slate-500 mt-0.5">By {item.user}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
