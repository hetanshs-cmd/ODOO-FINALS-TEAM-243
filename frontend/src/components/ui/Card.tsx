import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  isAiAccent?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  footer,
  padding = 'md',
  isAiAccent = false,
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  return (
    <div
      className={`bg-white rounded-md border ${
        isAiAccent
          ? 'border-[#C4B5FD] ring-1 ring-[#EDE9FE]'
          : 'border-[#E5E7EB]'
      } shadow-2xs ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6] gap-3">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-xs font-semibold text-[#1F2937] tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-[11px] text-[#6B7280] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
      {footer && (
        <div className="px-4 py-2.5 bg-[#F9FAFB] border-t border-[#F3F4F6] rounded-b-md text-xs text-[#4B5563]">
          {footer}
        </div>
      )}
    </div>
  );
};

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-[#E5E7EB] gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 pb-2.5 pt-1 px-3 text-xs font-medium border-b-2 transition-colors -mb-px select-none cursor-pointer ${
              isActive
                ? 'border-[#714B67] text-[#714B67] font-semibold'
                : 'border-transparent text-[#6B7280] hover:text-[#1F2937] hover:border-[#D1D5DB]'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                  isActive ? 'bg-[#F3EDF2] text-[#714B67]' : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
