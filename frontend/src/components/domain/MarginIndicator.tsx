import React from 'react';

export interface MarginIndicatorProps {
  currentMarginPercent: number;
  targetMarginPercent?: number;
  floorMarginPercent?: number;
  size?: 'sm' | 'md';
  showDetails?: boolean;
}

export const MarginIndicator: React.FC<MarginIndicatorProps> = ({
  currentMarginPercent,
  targetMarginPercent = 40,
  floorMarginPercent = 25,
  size = 'md',
  showDetails = true,
}) => {
  const isHealthy = currentMarginPercent >= targetMarginPercent;
  const isWarning = currentMarginPercent < targetMarginPercent && currentMarginPercent >= floorMarginPercent;

  const colorClass = isHealthy
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : isWarning
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';

  const barColor = isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className={`flex flex-col gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">Blended Gross Margin</span>
        <span className={`font-mono font-bold px-2 py-0.5 rounded border text-xs ${colorClass}`}>
          {currentMarginPercent.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, currentMarginPercent))}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
          style={{ left: `${targetMarginPercent}%` }}
          title={`Target Margin (${targetMarginPercent}%)`}
        />
      </div>
      {showDetails && (
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Floor: {floorMarginPercent}%</span>
          <span>Target: {targetMarginPercent}%</span>
        </div>
      )}
    </div>
  );
};
