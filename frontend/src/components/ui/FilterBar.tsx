import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (val: string) => void;
  }[];
  onReset?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchPlaceholder = 'Search records...',
  searchValue,
  onSearchChange,
  filters = [],
  onReset,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2.5 mb-3.5 bg-white p-2.5 rounded-md border border-[#E5E7EB] shadow-2xs ${className}`}>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
        <div className="w-full sm:w-60">
          <Input
            leftIcon={<Search className="w-3.5 h-3.5 text-[#9CA3AF]" />}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {filters.map((filter) => (
          <div key={filter.id} className="relative flex items-center">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="bg-[#F8F9FA] hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] rounded-md text-xs px-2.5 py-1.5 h-8.5 font-medium focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67] transition-colors cursor-pointer"
            >
              <option value="">All {filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={<RotateCcw className="w-3 h-3" />}
          >
            Reset
          </Button>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
