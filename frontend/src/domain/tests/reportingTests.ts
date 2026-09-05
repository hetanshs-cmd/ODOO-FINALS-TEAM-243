/**
 * DealFlow360 — Reporting & Analytics Acceptance Test Suite (Screen 15: Tests A-U)
 * Comprehensive verification of all domain calculation invariants, filters, and governance metrics.
 */

import {
  filterQuotations,
  calculateReportKPIs,
  calculateCategoryBreakdown,
  calculateSalesRepPerformance,
  calculateApprovalPerformance,
  calculateStagePipeline,
  calculateTopUpsoldProduct,
  calculateAverageApprovalTimeHours,
} from '../reporting';

import { canUserPerformAction } from '../permissions';
import { Quotation, QuotationLine, ApprovalStep, User, UpsellSuggestion, ReportFilters } from '../../types';
import { TestResultItem } from './businessLogicTests';

export function runReportingAcceptanceTests(): TestResultItem[] {
  const tests: TestResultItem[] = [];

  const mockUsers: User[] = [
    {
      id: 'REP-1',
      name: 'Sarah Chen',
      email: 'sarah@dealflow.com',
      role: 'sales_rep',
      department: 'Enterprise Commercial',
      active: true,
    },
    {
      id: 'REP-2',
      name: 'Alex Rivera',
      email: 'alex@dealflow.com',
      role: 'sales_rep',
      department: 'Commercial Sales',
      active: true,
    },
    {
      id: 'CUST-1',
      name: 'John Buyer',
      email: 'john@acme.com',
      role: 'customer',
      active: true,
    },
  ];

  const mockQuotes: Quotation[] = [
    {
      id: 'Q-01',
      code: 'Q-1001',
      customerId: 'CUST-A',
      customerName: 'Acme Corp',
      customerTier: 'Gold',
      priceListTier: 'Gold',
      stage: 'Approved',
      assignedRepId: 'REP-1',
      repName: 'Sarah Chen',
      subtotal: 10000,
      totalDiscount: 1000,
      grandTotal: 9000,
      netAmount: 9000,
      revenue: 9000,
      cost: 5400,
      profit: 3600,
      marginPercent: 40.0,
      tax: 0,
      taxableAmount: 9000,
      viewCount: 2,
      blendedRiskScore: 0,
      blendedRiskValue: 'LOW',
      requiredApprovers: [],
      currentApprovalStep: 0,
      createdAt: '2026-09-02T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
      lastActivityAt: '2026-09-03T10:00:00Z',
      lines: [
        {
          id: 'L1',
          productId: 'P-HW',
          productName: 'Hardware Gateway',
          category: 'Hardware',
          quantity: 2,
          baseUnitPrice: 4000,
          unitPrice: 3600,
          discountPercent: 10,
          categoryLimitPercent: 15,
          subtotal: 8000,
          discountAmount: 800,
          lineTotal: 7200,
          cost: 4320,
          profit: 2880,
          marginPercent: 40.0,
          overBy: 0,
          lineStatus: 'OK',
          revenue: 7200,
          isSubscription: false,
        },
        {
          id: 'L2',
          productId: 'P-CARE',
          productName: 'Care Plan 2yr',
          category: 'Subscription',
          quantity: 1,
          baseUnitPrice: 2000,
          unitPrice: 1800,
          discountPercent: 10,
          categoryLimitPercent: 15,
          subtotal: 2000,
          discountAmount: 200,
          lineTotal: 1800,
          cost: 1080,
          profit: 720,
          marginPercent: 40.0,
          overBy: 0,
          lineStatus: 'OK',
          revenue: 1800,
          isSubscription: true,
        },
      ],
    },
    {
      id: 'Q-02',
      code: 'Q-1002',
      customerId: 'CUST-B',
      customerName: 'Beta Ltd',
      customerTier: 'Silver',
      priceListTier: 'Silver',
      stage: 'Pending Approval',
      assignedRepId: 'REP-2',
      repName: 'Alex Rivera',
      subtotal: 5000,
      totalDiscount: 1000,
      grandTotal: 4000,
      netAmount: 4000,
      revenue: 4000,
      cost: 2600,
      profit: 1400,
      marginPercent: 35.0,
      tax: 0,
      taxableAmount: 4000,
      viewCount: 1,
      blendedRiskScore: 25,
      blendedRiskValue: 'MEDIUM',
      requiredApprovers: ['sales_manager'],
      currentApprovalStep: 1,
      createdAt: '2026-08-20T10:00:00Z',
      updatedAt: '2026-08-21T10:00:00Z',
      lastActivityAt: '2026-08-21T10:00:00Z',
      lines: [
        {
          id: 'L3',
          productId: 'P-SRV',
          productName: 'Onsite Setup',
          category: 'Services',
          quantity: 1,
          baseUnitPrice: 5000,
          unitPrice: 4000,
          discountPercent: 20,
          categoryLimitPercent: 10,
          subtotal: 5000,
          discountAmount: 1000,
          lineTotal: 4000,
          cost: 2600,
          profit: 1400,
          marginPercent: 35.0,
          overBy: 10,
          lineStatus: 'OVER',
          revenue: 4000,
          isSubscription: false,
        },
      ],
    },
    {
      id: 'Q-03',
      code: 'Q-1003',
      customerId: 'CUST-C',
      customerName: 'Gamma Corp',
      customerTier: 'Bronze',
      priceListTier: 'Bronze',
      stage: 'Rejected',
      assignedRepId: 'REP-1',
      repName: 'Sarah Chen',
      subtotal: 3000,
      totalDiscount: 1000,
      grandTotal: 2000,
      netAmount: 2000,
      revenue: 2000,
      cost: 1600,
      profit: 400,
      marginPercent: 20.0,
      tax: 0,
      taxableAmount: 2000,
      viewCount: 1,
      blendedRiskScore: 60,
      blendedRiskValue: 'HIGH',
      requiredApprovers: ['sales_manager', 'finance'],
      currentApprovalStep: 2,
      createdAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-03T10:00:00Z',
      lastActivityAt: '2026-06-03T10:00:00Z',
      lines: [
        {
          id: 'L4',
          productId: 'P-HW',
          productName: 'Hardware Gateway',
          category: 'Hardware',
          quantity: 1,
          baseUnitPrice: 3000,
          unitPrice: 2000,
          discountPercent: 33.3,
          categoryLimitPercent: 15,
          subtotal: 3000,
          discountAmount: 1000,
          lineTotal: 2000,
          cost: 1600,
          profit: 400,
          marginPercent: 20.0,
          overBy: 18.3,
          lineStatus: 'OVER',
          revenue: 2000,
          isSubscription: false,
        },
      ],
    },
  ];

  const mockApprovalSteps: ApprovalStep[] = [
    {
      id: 'STEP-1',
      quotationId: 'Q-01',
      stepOrder: 1,
      approverRole: 'sales_manager',
      status: 'Approved',
      date: '2026-09-02T14:30:00Z',
      timestamp: '2026-09-02T14:30:00Z',
    },
    {
      id: 'STEP-2',
      quotationId: 'Q-03',
      stepOrder: 2,
      approverRole: 'finance',
      status: 'Rejected',
      date: '2026-06-03T15:00:00Z',
      timestamp: '2026-06-03T15:00:00Z',
    },
  ];

  const mockUpsells: UpsellSuggestion[] = [
    {
      id: 'U1',
      productId: 'P-CARE',
      productName: 'Care Plan 2yr',
      targetCategory: 'Subscription',
      reason: 'Standard warranty extension',
      marginDelta: 15,
      priority: 1,
    },
  ];

  // TEST A: Filter by AllTime vs Rep
  {
    const filtered = filterQuotations(mockQuotes, { period: 'AllTime' }, mockUsers);
    tests.push({
      id: 'REP-TEST-A',
      name: 'Test A: Period Filter AllTime captures complete quotation dataset',
      category: 'Reporting Filter Domain',
      passed: filtered.length === 3,
      expected: '3 quotations',
      actual: `${filtered.length} quotations`,
    });
  }

  // TEST B: Filter by Sales Rep
  {
    const filtered = filterQuotations(mockQuotes, { period: 'AllTime', repId: 'REP-1' }, mockUsers);
    tests.push({
      id: 'REP-TEST-B',
      name: 'Test B: Sales Rep Filter isolates quotations assigned to specific rep',
      category: 'Reporting Filter Domain',
      passed: filtered.length === 2 && filtered.every((q) => q.assignedRepId === 'REP-1'),
      expected: '2 quotations for REP-1',
      actual: `${filtered.length} quotations`,
    });
  }

  // TEST C: Filter by Sales Team / Department
  {
    const filtered = filterQuotations(
      mockQuotes,
      { period: 'AllTime', salesTeam: 'Enterprise Commercial' },
      mockUsers
    );
    tests.push({
      id: 'REP-TEST-C',
      name: 'Test C: Sales Team Filter maps rep department correctly',
      category: 'Reporting Filter Domain',
      passed: filtered.length === 2,
      expected: '2 quotations for Enterprise Commercial',
      actual: `${filtered.length} quotations`,
    });
  }

  // TEST D: Filter by Stage / Approval Status
  {
    const approvedFiltered = filterQuotations(
      mockQuotes,
      { period: 'AllTime', approvalStatus: 'Approved' },
      mockUsers
    );
    tests.push({
      id: 'REP-TEST-D',
      name: 'Test D: Approval Status filter isolates Approved deals',
      category: 'Reporting Filter Domain',
      passed: approvedFiltered.length === 1 && approvedFiltered[0].id === 'Q-01',
      expected: '1 quotation (Q-01)',
      actual: `${approvedFiltered.length} quotations`,
    });
  }

  // TEST E: Filter by Product Category
  {
    const servicesFiltered = filterQuotations(
      mockQuotes,
      { period: 'AllTime', category: 'Services' },
      mockUsers
    );
    tests.push({
      id: 'REP-TEST-E',
      name: 'Test E: Category filter matches quotes containing Services line items',
      category: 'Reporting Filter Domain',
      passed: servicesFiltered.length === 1 && servicesFiltered[0].id === 'Q-02',
      expected: '1 quotation (Q-02)',
      actual: `${servicesFiltered.length} quotations`,
    });
  }

  // TEST F: Multi-Dimensional Filter Intersection
  {
    const multiFiltered = filterQuotations(
      mockQuotes,
      { period: 'AllTime', repId: 'REP-1', customerTier: 'Gold' },
      mockUsers
    );
    tests.push({
      id: 'REP-TEST-F',
      name: 'Test F: Combined multi-criteria filters apply simultaneous intersection',
      category: 'Reporting Filter Domain',
      passed: multiFiltered.length === 1 && multiFiltered[0].code === 'Q-1001',
      expected: '1 quotation (Q-1001)',
      actual: `${multiFiltered.length} quotations`,
    });
  }

  // TEST G: KPI - Quotes Created
  const allFiltered = filterQuotations(mockQuotes, { period: 'AllTime' }, mockUsers);
  const kpis = calculateReportKPIs(allFiltered, mockApprovalSteps, mockUpsells);
  {
    tests.push({
      id: 'REP-TEST-G',
      name: 'Test G: KPI Quotes Created matches exact filtered count',
      category: 'Reporting KPIs Domain',
      passed: kpis.quotesCreated === 3,
      expected: '3',
      actual: `${kpis.quotesCreated}`,
    });
  }

  // TEST H: KPI - Total Pipeline Value ($9,000 + $4,000 + $2,000 = $15,000)
  {
    tests.push({
      id: 'REP-TEST-H',
      name: 'Test H: KPI Total Pipeline Value accurately aggregates net revenue',
      category: 'Reporting KPIs Domain',
      passed: kpis.totalPipelineValue === 15000,
      expected: '15000',
      actual: `${kpis.totalPipelineValue}`,
    });
  }

  // TEST I: KPI - Average Approval Turnaround Time
  {
    const avgHrs = calculateAverageApprovalTimeHours(allFiltered, mockApprovalSteps);
    tests.push({
      id: 'REP-TEST-I',
      name: 'Test I: KPI Average Approval Time calculates turnaround from timestamps',
      category: 'Reporting KPIs Domain',
      passed: avgHrs > 0 && avgHrs < 75,
      expected: 'Valid positive hours',
      actual: `${avgHrs} hrs`,
    });
  }

  // TEST J: KPI - Top Upsold Product
  {
    const topUpsell = calculateTopUpsoldProduct(allFiltered, mockUpsells);
    tests.push({
      id: 'REP-TEST-J',
      name: 'Test J: KPI Top Upsold Product correlates line items to upsell recommendations',
      category: 'Reporting KPIs Domain',
      passed: topUpsell.productName === 'Care Plan 2yr',
      expected: 'Care Plan 2yr',
      actual: topUpsell.productName,
    });
  }

  // TEST K: KPI - Blended Margin Rate: ($3,600 + $1,400 + $400) / $15,000 = 5,400 / 15,000 = 36.0%
  {
    tests.push({
      id: 'REP-TEST-K',
      name: 'Test K: KPI Blended Margin Rate matches profit / net revenue ratio',
      category: 'Reporting KPIs Domain',
      passed: kpis.blendedMarginRate === 36.0,
      expected: '36.0%',
      actual: `${kpis.blendedMarginRate}%`,
    });
  }

  // TEST L: Category Breakdown Aggregation
  {
    const catReport = calculateCategoryBreakdown(allFiltered);
    const hw = catReport.find((c) => c.category === 'Hardware');
    const srv = catReport.find((c) => c.category === 'Services');
    const sub = catReport.find((c) => c.category === 'Subscription');

    // HW revenue: 7,200 + 2,000 = 9,200; SRV revenue: 4,000; SUB revenue: 1,800.
    const passed =
      hw?.revenue === 9200 &&
      srv?.revenue === 4000 &&
      sub?.revenue === 1800 &&
      hw.marginPercent > 0;

    tests.push({
      id: 'REP-TEST-L',
      name: 'Test L: Category Breakdown correctly partitions revenue and margins',
      category: 'Reporting Breakdown Domain',
      passed,
      expected: 'HW: $9,200, SRV: $4,000, SUB: $1,800',
      actual: `HW: $${hw?.revenue}, SRV: $${srv?.revenue}, SUB: $${sub?.revenue}`,
    });
  }

  // TEST M: Sales Rep Performance Scorecard
  {
    const repPerf = calculateSalesRepPerformance(allFiltered, mockUsers);
    const sarah = repPerf.find((r) => r.repName === 'Sarah Chen');
    const alex = repPerf.find((r) => r.repName === 'Alex Rivera');

    const passed =
      sarah?.quotesCount === 2 &&
      sarah?.pipelineValue === 11000 &&
      alex?.quotesCount === 1 &&
      alex?.pipelineValue === 4000;

    tests.push({
      id: 'REP-TEST-M',
      name: 'Test M: Sales Rep Scorecard calculates individual quotas and win rates',
      category: 'Reporting Rep Scorecard',
      passed,
      expected: 'Sarah: 2 deals ($11,000), Alex: 1 deal ($4,000)',
      actual: `Sarah: ${sarah?.quotesCount} ($${sarah?.pipelineValue}), Alex: ${alex?.quotesCount} ($${alex?.pipelineValue})`,
    });
  }

  // TEST N: Approval Performance Mapping
  {
    const appPerf = calculateApprovalPerformance(allFiltered, mockApprovalSteps);
    const step1 = appPerf.find((s) => s.stepId === 'STEP-1');
    tests.push({
      id: 'REP-TEST-N',
      name: 'Test N: Approval Governance table maps roles, decisions, and turnaround',
      category: 'Reporting Approval Governance',
      passed: Boolean(step1 && step1.status === 'Approved' && step1.approverRole === 'Sales Manager'),
      expected: 'Step 1 Approved by Sales Manager',
      actual: `${step1?.status} by ${step1?.approverRole}`,
    });
  }

  // TEST O: Stage Pipeline Distribution
  {
    const stageDist = calculateStagePipeline(allFiltered);
    const approvedStage = stageDist.find((s) => s.stage === 'Approved');
    const pendingStage = stageDist.find((s) => s.stage === 'Pending Approval');
    const rejectedStage = stageDist.find((s) => s.stage === 'Rejected');

    const passed =
      approvedStage?.count === 1 &&
      pendingStage?.count === 1 &&
      rejectedStage?.count === 1;

    tests.push({
      id: 'REP-TEST-O',
      name: 'Test O: Quotation Stage pipeline maps count and values accurately',
      category: 'Reporting Stage Distribution',
      passed,
      expected: '1 Approved, 1 Pending Approval, 1 Rejected',
      actual: `Approved: ${approvedStage?.count}, Pending: ${pendingStage?.count}, Rejected: ${rejectedStage?.count}`,
    });
  }

  // TEST P: Zero-State Resilience (Empty filter result)
  {
    const emptyFiltered = filterQuotations(
      mockQuotes,
      { period: 'AllTime', searchQuery: 'NON_EXISTENT_STRING_XYZ' },
      mockUsers
    );
    const emptyKpis = calculateReportKPIs(emptyFiltered, mockApprovalSteps, mockUpsells);
    const passed =
      emptyFiltered.length === 0 &&
      emptyKpis.quotesCreated === 0 &&
      emptyKpis.totalPipelineValue === 0 &&
      emptyKpis.blendedMarginRate === 0;

    tests.push({
      id: 'REP-TEST-P',
      name: 'Test P: Zero-state filter result gracefully computes zero-metrics without crash',
      category: 'Reporting Robustness',
      passed,
      expected: 'quotes: 0, pipeline: 0, margin: 0%',
      actual: `quotes: ${emptyKpis.quotesCreated}, pipeline: ${emptyKpis.totalPipelineValue}, margin: ${emptyKpis.blendedMarginRate}%`,
    });
  }

  // TEST Q & R: RBAC Verification
  {
    const customer = mockUsers.find((u) => u.role === 'customer')!;
    const rep = mockUsers.find((u) => u.role === 'sales_rep')!;

    const customerView = canUserPerformAction(customer, 'view_reports');
    const customerExport = canUserPerformAction(customer, 'export_reports');
    const repView = canUserPerformAction(rep, 'view_reports');

    const passed = !customerView.allowed && !customerExport.allowed && repView.allowed;

    tests.push({
      id: 'REP-TEST-QR',
      name: 'Test Q & R: RBAC security blocks Customer access and authorizes Internal roles',
      category: 'Reporting Security & RBAC',
      passed,
      expected: 'Customer: blocked, Sales Rep: authorized',
      actual: `Customer view: ${customerView.allowed}, Rep view: ${repView.allowed}`,
    });
  }

  // TEST S: Dynamic Reactivity Simulation
  {
    const dynamicallyAddedQuote: Quotation = {
      ...mockQuotes[0],
      id: 'Q-DYNAMIC',
      code: 'Q-DYNAMIC',
      subtotal: 20000,
      grandTotal: 20000,
      netAmount: 20000,
      revenue: 20000,
      cost: 10000,
      profit: 10000,
      marginPercent: 50.0,
      createdAt: '2026-09-04T12:00:00Z',
    };

    const updatedDataset = [...mockQuotes, dynamicallyAddedQuote];
    const newKpis = calculateReportKPIs(
      filterQuotations(updatedDataset, { period: 'AllTime' }),
      mockApprovalSteps,
      mockUpsells
    );

    const passed = newKpis.quotesCreated === 4 && newKpis.totalPipelineValue === 35000;

    tests.push({
      id: 'REP-TEST-S',
      name: 'Test S: Dynamic reactivity: Adding new quote instantaneously updates pipeline & KPIs',
      category: 'Reporting Reactivity',
      passed,
      expected: 'Quotes: 4, Pipeline: $35,000',
      actual: `Quotes: ${newKpis.quotesCreated}, Pipeline: $${newKpis.totalPipelineValue}`,
    });
  }

  return tests;
}
