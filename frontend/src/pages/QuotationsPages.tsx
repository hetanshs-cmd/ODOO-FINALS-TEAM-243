import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,
  RotateCw,
  MoreHorizontal,
  ExternalLink,
  Copy,
  AlertCircle,
  Inbox,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatusBadge, RiskBadge } from '../components/ui/Badge';
import { QuotationToolbar, FilterState } from '../components/domain/QuotationToolbar';
import { toast } from '../components/ui/Toast';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { Quotation, RiskLevel } from '../types';
import {
  formatCurrency,
  formatRelativeTime,
  formatExactDateTime,
  formatPercent,
} from '../utils/formatters';

export const QuotationsListPage: React.FC = () => {
  const { quotations, customers, users, refreshData, createQuotation } = useDealStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state for refreshing indicator
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Parse filters from URL params or defaults
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get('search') || '',
    stage: searchParams.get('stage') || '',
    risk: searchParams.get('risk') || '',
    repId: searchParams.get('rep') || '',
    customerId: searchParams.get('customer') || '',
    myQuotationsOnly: searchParams.get('myQuotes') === 'true',
    groupBy: (searchParams.get('groupBy') as FilterState['groupBy']) || 'none',
  }));

  // Sorting state (default: Last Activity descending)
  const [sortColumn, setSortColumn] = useState<string>(searchParams.get('sort') || 'lastActivityAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    (searchParams.get('dir') as 'asc' | 'desc') || 'desc'
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [pageSize, setPageSize] = useState<number>(10);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.risk) params.set('risk', filters.risk);
    if (filters.repId) params.set('rep', filters.repId);
    if (filters.customerId) params.set('customer', filters.customerId);
    if (filters.myQuotationsOnly) params.set('myQuotes', 'true');
    if (filters.groupBy && filters.groupBy !== 'none') params.set('groupBy', filters.groupBy);
    if (sortColumn !== 'lastActivityAt') params.set('sort', sortColumn);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);
    if (currentPage > 1) params.set('page', String(currentPage));

    setSearchParams(params, { replace: true });
  }, [filters, sortColumn, sortDirection, currentPage, setSearchParams]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // reset to page 1 on filter change
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      search: '',
      stage: '',
      risk: '',
      repId: '',
      customerId: '',
      myQuotationsOnly: false,
      groupBy: 'none',
    });
    setCurrentPage(1);
  };

  // Handle Sort column click
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection(columnKey === 'lastActivityAt' || columnKey === 'amount' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Manual data reload action
  const handleReload = () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Sales reps list
  const salesReps = useMemo(() => {
    const repUsers = users.filter(
      (u) => u.role.toLowerCase() === 'sales_rep' || u.role.toLowerCase() === 'salesrep'
    );
    if (repUsers.length > 0) {
      return repUsers.map((u) => ({ id: u.id, name: u.name }));
    }
    // Fallback: extract distinct reps from quotations
    const map = new Map<string, string>();
    quotations.forEach((q) => {
      if (q.assignedRepId && q.repName) map.set(q.assignedRepId, q.repName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users, quotations]);

  // Customer options list
  const customerList = useMemo(() => {
    if (customers && customers.length > 0) {
      return customers.map((c) => ({ id: c.id, name: c.name }));
    }
    const map = new Map<string, string>();
    quotations.forEach((q) => {
      if (q.customerId && q.customerName) map.set(q.customerId, q.customerName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [customers, quotations]);

  // Stage counts for quick filter tabs
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quotations.length };
    quotations.forEach((q) => {
      // Normalize 'PendingApproval' alias to 'Pending Approval'
      const s = q.stage === 'PendingApproval' ? 'Pending Approval' : q.stage;
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [quotations]);

  // Check if current user is sales rep
  const isSalesRep = user.role.toLowerCase() === 'sales_rep' || user.role.toLowerCase() === 'salesrep';

  // 1. FILTERING
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      // Search across Quotation ID, Customer name, Rep name, Stage
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const codeMatch = q.code.toLowerCase().includes(query);
        const custMatch = (q.customerName || '').toLowerCase().includes(query);
        const repMatch = (q.repName || '').toLowerCase().includes(query);
        const stageMatch = q.stage.toLowerCase().includes(query);
        if (!codeMatch && !custMatch && !repMatch && !stageMatch) {
          return false;
        }
      }

      // Stage filter (support both 'Pending Approval' and 'PendingApproval' alias)
      if (filters.stage) {
        const targetStage = filters.stage.toLowerCase().replace(/\s+/g, '');
        const currentStage = q.stage.toLowerCase().replace(/\s+/g, '');
        if (targetStage !== currentStage) {
          return false;
        }
      }

      // Risk filter
      if (filters.risk) {
        const qRisk = (q.blendedRiskValue || q.blendedRiskLevel || 'LOW').toUpperCase();
        if (qRisk !== filters.risk.toUpperCase()) {
          return false;
        }
      }

      // Sales Rep filter
      if (filters.repId) {
        const matchRepId = q.assignedRepId === filters.repId || q.repId === filters.repId;
        const matchRepName = (q.repName || '').toLowerCase() === filters.repId.toLowerCase();
        if (!matchRepId && !matchRepName) {
          return false;
        }
      }

      // Customer filter
      if (filters.customerId) {
        const matchCustId = q.customerId === filters.customerId;
        const matchCustName = (q.customerName || '').toLowerCase() === filters.customerId.toLowerCase();
        if (!matchCustId && !matchCustName) {
          return false;
        }
      }

      // My Quotations filter
      if (filters.myQuotationsOnly) {
        const isMine =
          q.assignedRepId === user.id ||
          q.repId === user.id ||
          (q.repName && user.name && q.repName.toLowerCase() === user.name.toLowerCase());
        if (!isMine) {
          return false;
        }
      }

      return true;
    });
  }, [quotations, filters, user]);

  // 2. SORTING (Non-mutating)
  const sortedQuotations = useMemo(() => {
    return [...filteredQuotations].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'customerName':
          comparison = (a.customerName || '').localeCompare(b.customerName || '');
          break;
        case 'amount': {
          const amtA = a.grandTotal ?? a.netAmount ?? a.totalAmount ?? 0;
          const amtB = b.grandTotal ?? b.netAmount ?? b.totalAmount ?? 0;
          comparison = amtA - amtB;
          break;
        }
        case 'stage':
          comparison = a.stage.localeCompare(b.stage);
          break;
        case 'risk': {
          const scoreA = a.blendedRiskScore ?? 0;
          const scoreB = b.blendedRiskScore ?? 0;
          comparison = scoreA - scoreB;
          break;
        }
        case 'repName':
          comparison = (a.repName || '').localeCompare(b.repName || '');
          break;
        case 'margin': {
          const marginA = a.blendedMarginPercent ?? a.marginPercent ?? 0;
          const marginB = b.blendedMarginPercent ?? b.marginPercent ?? 0;
          comparison = marginA - marginB;
          break;
        }
        case 'lastActivityAt':
        default: {
          const dateA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const dateB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredQuotations, sortColumn, sortDirection]);

  // 3. GROUP BY
  const groupedData = useMemo(() => {
    if (filters.groupBy === 'none') return null;

    const groups: Record<string, { label: string; items: Quotation[]; totalAmount: number }> = {};

    sortedQuotations.forEach((q) => {
      let groupKey = 'Other';
      let groupLabel = 'Other';

      switch (filters.groupBy) {
        case 'stage':
          groupKey = q.stage === 'PendingApproval' ? 'Pending Approval' : q.stage;
          groupLabel = groupKey;
          break;
        case 'customer':
          groupKey = q.customerId || q.customerName || 'Unknown';
          groupLabel = q.customerName || 'Unknown Customer';
          break;
        case 'rep':
          groupKey = q.assignedRepId || q.repName || 'Unassigned';
          groupLabel = q.repName || 'Unassigned Rep';
          break;
        case 'risk':
          groupKey = q.blendedRiskValue || q.blendedRiskLevel || 'LOW';
          groupLabel = `${groupKey} Risk`;
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { label: groupLabel, items: [], totalAmount: 0 };
      }
      groups[groupKey].items.push(q);
      groups[groupKey].totalAmount += q.grandTotal ?? q.netAmount ?? q.totalAmount ?? 0;
    });

    return Object.entries(groups).map(([key, data]) => ({
      key,
      ...data,
    }));
  }, [sortedQuotations, filters.groupBy]);

  // 4. PAGINATION SLICE (Applied to ungrouped view)
  const totalPages = Math.max(1, Math.ceil(sortedQuotations.length / pageSize));
  const paginatedQuotations = useMemo(() => {
    if (filters.groupBy !== 'none') return sortedQuotations;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedQuotations.slice(startIndex, startIndex + pageSize);
  }, [sortedQuotations, currentPage, pageSize, filters.groupBy]);

  // Toggle group collapse
  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Close row action menus when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuRowId(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Render Table Header with Sort Indicators
  const renderSortHeader = (key: string, label: string, align: 'left' | 'right' = 'left') => {
    const isSorted = sortColumn === key;
    return (
      <th
        scope="col"
        onClick={() => handleSort(key)}
        className={`px-3.5 py-2.5 text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider select-none cursor-pointer hover:bg-[#F3EDF2]/60 hover:text-[#714B67] transition-colors ${
          align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
          <span>{label}</span>
          <span className="text-[#9CA3AF]">
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#714B67]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#714B67]" />
              )
            ) : (
              <ChevronsUpDown className="w-3 h-3 opacity-50" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Render individual row (dense Odoo style 44-48px)
  const renderRow = (q: Quotation) => {
    const quoteAmount = q.grandTotal ?? q.netAmount ?? q.totalAmount ?? 0;
    const quoteMargin = q.blendedMarginPercent ?? q.marginPercent;
    const riskLevel: RiskLevel = (q.blendedRiskLevel || q.blendedRiskValue || 'LOW') as RiskLevel;

    return (
      <tr
        key={q.id}
        tabIndex={0}
        role="button"
        aria-label={`Open quotation ${q.code}`}
        onClick={() => navigate(`/quotations/${q.code || q.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/quotations/${q.code || q.id}`);
          }
        }}
        className="group transition-colors cursor-pointer hover:bg-[#FAF5F8] active:bg-[#F3EDF2] focus:outline-none focus:bg-[#FAF5F8]"
      >
        {/* Quotation ID */}
        <td className="px-3.5 py-2.5 whitespace-nowrap align-middle">
          <span className="font-mono font-medium text-xs text-[#1F2937] group-hover:text-[#714B67] transition-colors">
            {q.code}
          </span>
        </td>

        {/* Customer */}
        <td className="px-3.5 py-2.5 align-middle">
          <div className="leading-tight max-w-[220px]">
            <span className="font-semibold text-xs text-[#111827] block truncate" title={q.customerName}>
              {q.customerName || 'Unnamed Customer'}
            </span>
            {q.customerTier && (
              <span className="text-[10px] text-[#6B7280] font-normal block">{q.customerTier} Tier</span>
            )}
          </div>
        </td>

        {/* Amount */}
        <td className="px-3.5 py-2.5 text-right whitespace-nowrap align-middle">
          <span className="font-mono font-semibold text-xs text-[#111827] tabular-nums">
            {formatCurrency(quoteAmount)}
          </span>
        </td>

        {/* Stage */}
        <td className="px-3.5 py-2.5 whitespace-nowrap align-middle">
          <StatusBadge status={q.stage} size="sm" />
        </td>

        {/* Risk */}
        <td className="px-3.5 py-2.5 whitespace-nowrap align-middle">
          <RiskBadge level={riskLevel} score={q.blendedRiskScore} size="sm" />
        </td>

        {/* Sales Rep */}
        <td className="px-3.5 py-2.5 whitespace-nowrap align-middle text-xs text-[#374151]">
          {q.repName || 'Unassigned'}
        </td>

        {/* Last Activity */}
        <td
          className="px-3.5 py-2.5 whitespace-nowrap align-middle text-xs text-[#6B7280]"
          title={formatExactDateTime(q.lastActivityAt)}
        >
          {formatRelativeTime(q.lastActivityAt)}
        </td>

        {/* Margin */}
        <td className="px-3.5 py-2.5 text-right whitespace-nowrap align-middle font-mono text-xs text-[#4B5563]">
          {quoteMargin !== undefined ? formatPercent(quoteMargin) : '—'}
        </td>

        {/* Row Action Menu */}
        <td
          className="px-3 py-2.5 text-right whitespace-nowrap align-middle relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-block relative">
            <button
              type="button"
              aria-label="Row actions"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuRowId(activeMenuRowId === q.id ? null : q.id);
              }}
              className="p-1 rounded text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {activeMenuRowId === q.id && (
              <div
                className="absolute right-0 top-full mt-1 w-36 bg-white rounded border border-[#E5E7EB] shadow-lg z-30 py-1 text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuRowId(null);
                    navigate(`/quotations/${q.code || q.id}`);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-[#374151] hover:bg-[#FAF5F8] hover:text-[#714B67] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuRowId(null);
                    const duplicateCode = `QT-2026-${1043 + quotations.length}`;
                    const duplicated = createQuotation({
                      ...q,
                      id: `QT-${duplicateCode}`,
                      code: duplicateCode,
                      stage: 'Draft',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      lastActivityAt: new Date().toISOString(),
                    });
                    toast.success('Quotation Duplicated', `Created draft copy ${duplicated.code}`);
                    navigate(`/quotations/${duplicated.id}`);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-[#374151] hover:bg-[#FAF5F8] hover:text-[#714B67] flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* 2. Compact Enterprise Page Header */}
      <PageHeader
        title="Quotations"
        description="Create, review, and monitor customer quotations through approval, negotiation, and confirmation."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Quotations' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleReload}
              title="Reload quotations data"
            >
              Reload Data
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/quotations/new')}
            >
              + New Quotation
            </Button>
          </div>
        }
      />

      {/* 3. Search / Filter / Group By Toolbar + Quick Stage Tabs */}
      <QuotationToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        stageCounts={stageCounts}
        totalCount={quotations.length}
        filteredCount={sortedQuotations.length}
        customers={customerList}
        salesReps={salesReps}
        isSalesRep={isSalesRep}
        currentUserName={user.name}
      />

      {/* 4. Odoo-Inspired Quotations Table */}
      <div className="w-full bg-white rounded-md border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            {/* Table Header */}
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
                {renderSortHeader('code', 'Quotation')}
                {renderSortHeader('customerName', 'Customer')}
                {renderSortHeader('amount', 'Amount', 'right')}
                {renderSortHeader('stage', 'Stage')}
                {renderSortHeader('risk', 'Risk')}
                {renderSortHeader('repName', 'Sales Rep')}
                {renderSortHeader('lastActivityAt', 'Last Activity')}
                {renderSortHeader('margin', 'Margin', 'right')}
                <th scope="col" className="px-3 py-2.5 text-right w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#F3F4F6] text-xs text-[#1F2937]">
              {/* 37. Loading State */}
              {isRefreshing ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-20" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-36" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-16 ml-auto" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-24" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-20" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-24" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-16" /></td>
                    <td className="px-3.5 py-3"><div className="h-3.5 bg-slate-200 rounded w-12 ml-auto" /></td>
                    <td className="px-3 py-3" />
                  </tr>
                ))
              ) : sortedQuotations.length === 0 ? (
                /* Empty States */
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    {quotations.length === 0 ? (
                      /* 35. Unfiltered Empty State */
                      <div className="max-w-sm mx-auto space-y-2">
                        <Inbox className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                        <h3 className="text-sm font-semibold text-[#111827]">No quotations yet</h3>
                        <p className="text-xs text-[#6B7280]">
                          Create your first quotation to start a governed sales workflow.
                        </p>
                        <div className="pt-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => navigate('/quotations/new')}
                          >
                            + New Quotation
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 36. Filtered Empty State */
                      <div className="max-w-sm mx-auto space-y-2">
                        <AlertCircle className="w-8 h-8 text-[#D97706] mx-auto" />
                        <h3 className="text-sm font-semibold text-[#111827]">No quotations match these filters</h3>
                        <p className="text-xs text-[#6B7280]">
                          Try adjusting your search or clearing one of the filters.
                        </p>
                        <div className="pt-2">
                          <Button variant="outline" size="sm" onClick={handleResetFilters}>
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : filters.groupBy !== 'none' && groupedData ? (
                /* Group By Rendering */
                groupedData.map((group) => {
                  const isCollapsed = collapsedGroups[group.key] || false;
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group Header Banner */}
                      <tr
                        onClick={() => toggleGroupCollapse(group.key)}
                        className="bg-[#F8F9FA] hover:bg-[#F3EDF2]/40 transition-colors cursor-pointer border-t border-b border-[#E5E7EB] select-none"
                      >
                        <td colSpan={9} className="px-3.5 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label="Toggle group collapse"
                                className="text-[#6B7280]"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5 text-[#714B67]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#714B67]" />
                                )}
                              </button>
                              <span className="font-semibold text-xs text-[#111827]">{group.label}</span>
                              <span className="text-[11px] font-medium text-[#6B7280] bg-[#E5E7EB] px-1.5 py-0.2 rounded-full font-mono">
                                {group.items.length}
                              </span>
                            </div>
                            <div className="text-xs text-[#4B5563]">
                              Total Value:{' '}
                              <strong className="font-mono font-semibold text-[#111827]">
                                {formatCurrency(group.totalAmount)}
                              </strong>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Group Rows */}
                      {!isCollapsed && group.items.map((q) => renderRow(q))}
                    </React.Fragment>
                  );
                })
              ) : (
                /* Standard Flat Table Rows */
                paginatedQuotations.map((q) => renderRow(q))
              )}
            </tbody>
          </table>
        </div>

        {/* 33. Pagination / Result Count Footer */}
        {filters.groupBy === 'none' && sortedQuotations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-[#F8F9FA] border-t border-[#E5E7EB] text-xs text-[#6B7280] gap-2">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#D1D5DB] rounded px-2 py-0.5 text-xs text-[#374151] focus:outline-none focus:border-[#714B67]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="ml-2">
                Showing{' '}
                <strong className="text-[#111827]">
                  {Math.min((currentPage - 1) * pageSize + 1, sortedQuotations.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-[#111827]">
                  {Math.min(currentPage * pageSize, sortedQuotations.length)}
                </strong>{' '}
                of <strong className="text-[#111827]">{sortedQuotations.length}</strong> quotations
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                ‹ Prev
              </button>
              <span className="px-2 font-mono text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { QuotationDetailPage } from './QuotationDetailPage';

