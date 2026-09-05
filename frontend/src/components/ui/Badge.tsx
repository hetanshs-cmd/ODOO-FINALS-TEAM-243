import React from 'react';
import { RiskLevel, QuotationStage, InvoiceStatus, SubscriptionStatus } from '../../types';

export interface BadgeProps {
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'ai' | 'plum';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.2 font-medium',
    md: 'text-[11px] px-2 py-0.5 font-medium',
  };

  const variantStyles = {
    neutral: 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]',
    info: 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]',
    success: 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
    danger: 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]',
    ai: 'bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] font-medium',
    plum: 'bg-[#F3EDF2] text-[#714B67] border border-[#E8DCE7] font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm tracking-tight whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  size?: 'sm' | 'md';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score, size = 'md' }) => {
  const configs: Record<RiskLevel, { variant: 'success' | 'warning' | 'danger'; label: string; dot: string }> = {
    LOW: { variant: 'success', label: 'LOW RISK', dot: 'bg-emerald-500' },
    MEDIUM: { variant: 'warning', label: 'MEDIUM RISK', dot: 'bg-amber-500' },
    HIGH: { variant: 'danger', label: 'HIGH RISK', dot: 'bg-rose-500' },
  };

  const config = configs[level] || configs.LOW;

  return (
    <Badge variant={config.variant} size={size}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      <span>{config.label}</span>
      {score !== undefined && <span className="opacity-80 font-mono ml-0.5">({score})</span>}
    </Badge>
  );
};

export interface StatusBadgeProps {
  status: QuotationStage | InvoiceStatus | SubscriptionStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'plum' = 'neutral';
  let label = status;

  switch (status) {
    case 'Draft':
      variant = 'neutral';
      label = 'Draft';
      break;
    case 'Pending Approval':
    case 'PendingApproval':
      variant = 'warning';
      label = 'Pending Approval';
      break;
    case 'Approved':
      variant = 'success';
      label = 'Approved';
      break;
    case 'Negotiation':
      variant = 'plum';
      label = 'Negotiation';
      break;
    case 'Confirmed':
      variant = 'success';
      label = 'Confirmed';
      break;
    case 'Rejected':
      variant = 'danger';
      label = 'Rejected';
      break;
    case 'Returned for Revision':
    case 'ReturnedForRevision':
      variant = 'warning';
      label = 'Returned for Revision';
      break;
    case 'Active':
    case 'Paid':
      variant = 'success';
      break;
    case 'Partially Paid':
    case 'Partially Shipped':
      variant = 'info';
      break;
    case 'Paused':
    case 'Unpaid':
      variant = 'warning';
      break;
    case 'Applied':
      variant = 'plum';
      break;
    case 'Cancelled':
    case 'Overdue':
      variant = 'danger';
      break;
    default:
      variant = 'neutral';
  }

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
};

export const StageBadge = StatusBadge;

