import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const variantStyles = {
    text: 'h-3.5 rounded-sm',
    rectangular: 'rounded-md',
    circular: 'rounded-full',
  };

  return (
    <div
      className={`bg-[#E5E7EB] animate-pulse ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    />
  );
};

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-md border border-dashed border-[#D1D5DB] bg-[#F9FAFB] ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[#F3EDF2] flex items-center justify-center text-[#714B67] mb-2.5">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-xs font-semibold text-[#1F2937]">{title}</h3>
      <p className="text-xs text-[#6B7280] max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-md border border-[#FECACA] bg-[#FEF2F2] ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center text-[#DC2626] mb-2.5">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-xs font-semibold text-[#991B1B]">{title}</h3>
      <p className="text-xs text-[#B91C1C] max-w-sm mt-1 leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-3.5">
          <Button variant="outline" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};
