import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { Skeleton } from './FeedbackStates';
import { EmptyState } from './FeedbackStates';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try clearing filters or adding new records.',
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  className = '',
}: DataTableProps<T>) {
  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`w-full bg-white rounded-md border border-[#E5E7EB] shadow-2xs overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    onClick={() => col.sortable && onSort && onSort(col.key)}
                    className={`px-3.5 py-2 text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider select-none ${
                      alignStyles[col.align || 'left']
                    } ${col.sortable ? 'cursor-pointer hover:bg-[#F3EDF2]/60 hover:text-[#714B67] transition-colors' : ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1 ${
                        col.align === 'right'
                          ? 'justify-end w-full'
                          : col.align === 'center'
                          ? 'justify-center w-full'
                          : ''
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[#9CA3AF]">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#714B67]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#714B67]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6] text-xs text-[#1F2937]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rIndex) => (
                <tr key={rIndex} className="animate-pulse">
                  {columns.map((col, cIndex) => (
                    <td key={cIndex} className="px-3.5 py-2.5">
                      <Skeleton className="h-3.5 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-[#FAF5F8] active:bg-[#F3EDF2]' : 'hover:bg-[#F9FAFB]'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 align-middle ${alignStyles[col.align || 'left']}`}
                    >
                      {col.render
                        ? col.render(row, index)
                        : (row as Record<string, unknown>)[col.key] !== undefined
                        ? String((row as Record<string, unknown>)[col.key])
                        : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
