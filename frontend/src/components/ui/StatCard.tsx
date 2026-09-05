import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  trend,
  icon,
  badge,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-md border border-[#E5E7EB] p-3.5 shadow-2xs flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between text-[#6B7280] mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{title}</span>
        {icon && <div className="text-[#6B7280] p-1 bg-[#F8F9FA] rounded">{icon}</div>}
        {badge}
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight text-[#1F2937] font-mono">{value}</div>
        {(subtext || trend) && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            {trend && (
              <span className={`font-semibold ${trend.isPositive ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {subtext && <span className="text-[#6B7280]">{subtext}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
