import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Layers, X, Check, RotateCcw, UserCheck } from 'lucide-react';
import { RiskLevel, QuotationStage } from '../../types';

export interface FilterState {
  search: string;
  stage: string;
  risk: string;
  repId: string;
  customerId: string;
  myQuotationsOnly: boolean;
  groupBy: 'none' | 'stage' | 'customer' | 'rep' | 'risk';
}

export interface QuotationToolbarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  stageCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  customers: { id: string; name: string }[];
  salesReps: { id: string; name: string }[];
  isSalesRep: boolean;
  currentUserName: string;
}

const STAGES: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Pending Approval', label: 'Pending Approval' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Negotiation', label: 'Negotiation' },
  { id: 'Confirmed', label: 'Confirmed' },
];

const RISKS: { id: string; label: string }[] = [
  { id: '', label: 'All Risk Levels' },
  { id: 'LOW', label: 'LOW' },
  { id: 'MEDIUM', label: 'MEDIUM' },
  { id: 'HIGH', label: 'HIGH' },
];

export const QuotationToolbar: React.FC<QuotationToolbarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  stageCounts,
  totalCount,
  filteredCount,
  customers,
  salesReps,
  isSalesRep,
  currentUserName,
}) => {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [groupByMenuOpen, setGroupByMenuOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const groupByRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (groupByRef.current && !groupByRef.current.contains(e.target as Node)) {
        setGroupByMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute active filter count
  const activeFiltersCount =
    (filters.stage ? 1 : 0) +
    (filters.risk ? 1 : 0) +
    (filters.repId ? 1 : 0) +
    (filters.customerId ? 1 : 0) +
    (filters.myQuotationsOnly ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  const selectedRepName = salesReps.find((r) => r.id === filters.repId)?.name || filters.repId;
  const selectedCustomerName = customers.find((c) => c.id === filters.customerId)?.name || filters.customerId;

  return (
    <div className="space-y-2.5">
      {/* Primary Odoo-Style Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 rounded-md border border-[#E5E7EB] shadow-2xs">
        {/* Left Side: Search + Dropdown Buttons */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Compact Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
            </div>
            <input
              type="text"
              id="quotations-search-input"
              aria-label="Search quotations"
              placeholder="Search quotations..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="w-full pl-8 pr-7 py-1.5 bg-[#F9FAFB] hover:bg-white focus:bg-white text-xs text-[#1F2937] placeholder-[#9CA3AF] rounded border border-[#D1D5DB] focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] transition-colors outline-none"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '' })}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-[#9CA3AF] hover:text-[#4B5563]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Odoo Filters Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              id="quotations-filters-btn"
              aria-expanded={filterMenuOpen}
              onClick={() => {
                setFilterMenuOpen(!filterMenuOpen);
                setGroupByMenuOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 h-8 rounded border transition-colors ${
                activeFiltersCount > 0
                  ? 'bg-[#F3EDF2] text-[#714B67] border-[#D8C7D5]'
                  : 'bg-[#F8F9FA] hover:bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#714B67]" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#714B67] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Filters Popover Menu */}
            {filterMenuOpen && (
              <div
                id="quotations-filters-popover"
                className="absolute top-full left-0 mt-1 w-72 bg-white rounded-md border border-[#E5E7EB] shadow-lg z-30 p-3 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2">
                  <span className="text-xs font-semibold text-[#111827]">Filter Quotations</span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetFilters();
                        setFilterMenuOpen(false);
                      }}
                      className="text-[11px] text-[#714B67] hover:underline font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Role Specific Preset: My Quotations */}
                {isSalesRep && (
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filters.myQuotationsOnly}
                        onChange={(e) => onFilterChange({ myQuotationsOnly: e.target.checked })}
                        className="rounded text-[#714B67] focus:ring-[#714B67] h-3.5 w-3.5 border-gray-300"
                      />
                      <span className="text-xs font-medium text-[#374151] flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-[#714B67]" />
                        My Quotations ({currentUserName})
                      </span>
                    </label>
                  </div>
                )}

                {/* Stage Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Stage</label>
                  <select
                    value={filters.stage}
                    onChange={(e) => onFilterChange({ stage: e.target.value })}
                    className="w-full bg-[#F9FAFB] text-xs border border-[#D1D5DB] rounded px-2 py-1.5 focus:border-[#714B67] focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Risk Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Blended Risk</label>
                  <select
                    value={filters.risk}
                    onChange={(e) => onFilterChange({ risk: e.target.value })}
                    className="w-full bg-[#F9FAFB] text-xs border border-[#D1D5DB] rounded px-2 py-1.5 focus:border-[#714B67] focus:outline-none"
                  >
                    {RISKS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sales Rep Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Sales Representative</label>
                  <select
                    value={filters.repId}
                    onChange={(e) => onFilterChange({ repId: e.target.value })}
                    className="w-full bg-[#F9FAFB] text-xs border border-[#D1D5DB] rounded px-2 py-1.5 focus:border-[#714B67] focus:outline-none"
                  >
                    <option value="">All Representatives</option>
                    {salesReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Customer</label>
                  <select
                    value={filters.customerId}
                    onChange={(e) => onFilterChange({ customerId: e.target.value })}
                    className="w-full bg-[#F9FAFB] text-xs border border-[#D1D5DB] rounded px-2 py-1.5 focus:border-[#714B67] focus:outline-none"
                  >
                    <option value="">All Customers</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[#F3F4F6] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFilterMenuOpen(false)}
                    className="text-xs bg-[#714B67] text-white px-3 py-1 rounded font-medium hover:bg-[#54374D]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Odoo Group By Dropdown */}
          <div className="relative" ref={groupByRef}>
            <button
              type="button"
              id="quotations-groupby-btn"
              aria-expanded={groupByMenuOpen}
              onClick={() => {
                setGroupByMenuOpen(!groupByMenuOpen);
                setFilterMenuOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 h-8 rounded border transition-colors ${
                filters.groupBy !== 'none'
                  ? 'bg-[#F3EDF2] text-[#714B67] border-[#D8C7D5]'
                  : 'bg-[#F8F9FA] hover:bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#714B67]" />
              <span>Group By</span>
              {filters.groupBy !== 'none' && (
                <span className="capitalize font-semibold text-[#714B67]">({filters.groupBy})</span>
              )}
            </button>

            {/* Group By Popover */}
            {groupByMenuOpen && (
              <div
                id="quotations-groupby-popover"
                className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md border border-[#E5E7EB] shadow-lg z-30 p-2 space-y-1"
              >
                <div className="text-[11px] font-semibold text-[#6B7280] px-2 py-1">Group Records By:</div>
                {[
                  { id: 'none', label: 'None (Standard List)' },
                  { id: 'stage', label: 'Stage' },
                  { id: 'customer', label: 'Customer' },
                  { id: 'rep', label: 'Sales Representative' },
                  { id: 'risk', label: 'Risk Level' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onFilterChange({ groupBy: item.id as FilterState['groupBy'] });
                      setGroupByMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between text-left text-xs px-2 py-1.5 rounded transition-colors ${
                      filters.groupBy === item.id
                        ? 'bg-[#F3EDF2] text-[#714B67] font-semibold'
                        : 'text-[#374151] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {filters.groupBy === item.id && <Check className="w-3.5 h-3.5 text-[#714B67]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset Action */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              id="quotations-reset-btn"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827] px-2 py-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right Side: Operational Result Count */}
        <div className="text-xs text-[#6B7280] font-medium shrink-0">
          {activeFiltersCount > 0 ? (
            <span>
              <strong className="text-[#111827]">{filteredCount}</strong> of {totalCount} quotations
            </span>
          ) : (
            <span>
              <strong className="text-[#111827]">{totalCount}</strong> quotations
            </span>
          )}
        </div>
      </div>

      {/* Stage Quick Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] pb-1 overflow-x-auto">
        {STAGES.map((s) => {
          const count = stageCounts[s.id || 'all'] ?? 0;
          const isActive = (filters.stage === s.id) || (!filters.stage && s.id === '');
          return (
            <button
              key={s.id || 'all'}
              type="button"
              onClick={() => onFilterChange({ stage: s.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t font-medium transition-colors whitespace-nowrap border-b-2 -mb-1 ${
                isActive
                  ? 'border-[#714B67] text-[#714B67] bg-[#FAF5F8] font-semibold'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
              }`}
            >
              <span>{s.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-[#714B67] text-white' : 'bg-[#E5E7EB] text-[#4B5563]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-[#6B7280] font-medium">Active filters:</span>

          {filters.search && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">
              <span>Search: &ldquo;{filters.search}&rdquo;</span>
              <button
                type="button"
                onClick={() => onFilterChange({ search: '' })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove search filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.myQuotationsOnly && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3EDF2] text-[#714B67] px-2 py-0.5 rounded border border-[#E8DCE7] font-medium">
              <span>My Quotations</span>
              <button
                type="button"
                onClick={() => onFilterChange({ myQuotationsOnly: false })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove My Quotations filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.stage && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">
              <span>Stage: {filters.stage}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ stage: '' })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove stage filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.risk && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">
              <span>Risk: {filters.risk}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ risk: '' })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove risk filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.repId && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">
              <span>Rep: {selectedRepName}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ repId: '' })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove rep filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.customerId && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded border border-[#E5E7EB]">
              <span>Customer: {selectedCustomerName}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ customerId: '' })}
                className="hover:text-red-600 ml-0.5"
                aria-label="Remove customer filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] text-[#714B67] hover:underline font-semibold ml-1 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
