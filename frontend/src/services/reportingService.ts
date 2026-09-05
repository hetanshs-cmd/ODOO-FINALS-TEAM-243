/**
 * DealFlow360 — Reporting Service
 * Connects the UI layer and domain calculations directly to canonical store state.
 */

import { dealStore } from '../store/dealStore';
import {
  ReportFilters,
  ReportKPIs,
  Quotation,
  CategoryReportItem,
  RepPerformanceItem,
  ApprovalPerformanceItem,
  StagePipelineItem,
  User,
} from '../types';

import {
  filterQuotations,
  calculateReportKPIs,
  calculateCategoryBreakdown,
  calculateSalesRepPerformance,
  calculateApprovalPerformance,
  calculateStagePipeline,
} from '../domain/reporting';

import { exportReportToPDF, exportReportToXLS } from './reportingExport';

export interface ComprehensiveReportData {
  appliedFilters: ReportFilters;
  filteredQuotations: Quotation[];
  kpis: ReportKPIs;
  categoryBreakdown: CategoryReportItem[];
  repPerformance: RepPerformanceItem[];
  approvalPerformance: ApprovalPerformanceItem[];
  stagePipeline: StagePipelineItem[];
  users: User[];
  availableTeams: string[];
}

export const reportingService = {
  /**
   * Calculates dynamic reporting payload based on current store state & filters.
   */
  getReportData(filters: ReportFilters): ComprehensiveReportData {
    const state = dealStore.getState();

    const filteredQuotations = filterQuotations(
      state.quotations,
      filters,
      state.users
    );

    const kpis = calculateReportKPIs(
      filteredQuotations,
      state.approvalSteps,
      state.upsellSuggestions,
      state.products
    );

    const categoryBreakdown = calculateCategoryBreakdown(filteredQuotations);
    const repPerformance = calculateSalesRepPerformance(filteredQuotations, state.users);
    const approvalPerformance = calculateApprovalPerformance(
      filteredQuotations,
      state.approvalSteps
    );
    const stagePipeline = calculateStagePipeline(filteredQuotations);

    // Extract unique sales teams / departments
    const availableTeams = Array.from(
      new Set(
        state.users
          .filter((u) => u.department && (u.role === 'sales_rep' || u.role === 'sales_manager'))
          .map((u) => u.department as string)
      )
    );

    return {
      appliedFilters: filters,
      filteredQuotations,
      kpis,
      categoryBreakdown,
      repPerformance,
      approvalPerformance,
      stagePipeline,
      users: state.users,
      availableTeams,
    };
  },

  /**
   * Exports real PDF document.
   */
  exportPDF(filters: ReportFilters): void {
    const data = this.getReportData(filters);
    const currentUser = dealStore.getState().currentUser;

    exportReportToPDF({
      title: 'Commercial Governance & Audit Executive Report',
      generatedAt: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      generatedBy: `${currentUser.name} (${currentUser.title || currentUser.role})`,
      filters,
      kpis: data.kpis,
      quotations: data.filteredQuotations,
      categoryBreakdown: data.categoryBreakdown,
      repPerformance: data.repPerformance,
      approvalPerformance: data.approvalPerformance,
    });
  },

  /**
   * Exports real Excel spreadsheet workbook.
   */
  exportXLS(filters: ReportFilters): void {
    const data = this.getReportData(filters);
    const currentUser = dealStore.getState().currentUser;

    exportReportToXLS({
      title: 'Commercial Governance & Audit Executive Report',
      generatedAt: new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      generatedBy: `${currentUser.name} (${currentUser.title || currentUser.role})`,
      filters,
      kpis: data.kpis,
      quotations: data.filteredQuotations,
      categoryBreakdown: data.categoryBreakdown,
      repPerformance: data.repPerformance,
      approvalPerformance: data.approvalPerformance,
    });
  },
};
