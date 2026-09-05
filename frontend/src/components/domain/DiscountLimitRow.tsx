import React from 'react';

export interface DiscountLimitRowProps {
  discountPercent: number;
  allowedLimitPercent: number;
  overByPoints: number;
  category?: string;
  tier?: string;
  className?: string;
}

export const DiscountLimitRow: React.FC<DiscountLimitRowProps> = ({
  discountPercent,
  allowedLimitPercent,
  overByPoints,
  category,
  tier,
  className = '',
}) => {
  const isOver = overByPoints > 0;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
        isOver
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      } ${className}`}
      title={
        category && tier
          ? `Governed by ${category} category ceiling and ${tier} tier limit.`
          : undefined
      }
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{discountPercent}%</span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600">Limit: {allowedLimitPercent}%</span>
        <span className="text-slate-400">|</span>
        <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isOver ? `+${overByPoints} pts` : 'OK (0 pts)'}
        </span>
      </div>
    </div>
  );
};
