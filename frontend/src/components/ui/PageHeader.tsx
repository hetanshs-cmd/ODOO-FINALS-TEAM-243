import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-[#6B7280] mb-1.5 select-none ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-[#714B67] transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-[#1F2937]' : ''}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3 text-[#9CA3AF] shrink-0" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div className={`mb-4 pb-3.5 border-b border-[#E5E7EB] ${className}`}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#1F2937] tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-xs text-[#6B7280] mt-0.5 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
