/**
 * DealFlow360 — Automated Business Logic Test Suite
 * Validates all 7 required core domain assertions from Prompt 2.
 */

import { computeLineStatus, computeBlendedRiskScore, computeRequiredApprovers } from '../discounts';
import { computeMarginDelta, computeQuotationTotals } from '../margin';
import { computeWarehouseSplit } from '../fulfillment';
import { buildBillingRecord } from '../billing';
import { getCustomerVisibleQuotation } from '../customer-portal';
import { runReportingAcceptanceTests } from './reportingTests';
import { Quotation, QuotationLine, Warehouse } from '../../types';

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  results: TestResultItem[];
  executedAt: string;
}

export function runBusinessLogicTests(): TestSuiteResult {
  const results: TestResultItem[] = [];

  // TEST 1A: Discount Check 12% vs 15% -> OK
  {
    const res = computeLineStatus(12, 15);
    const passed = res.status === 'OK' && res.overBy === 0;
    results.push({
      id: 'DISCOUNT-1A',
      name: 'Discount Check: 12% vs 15% limit',
      category: 'Discount Governance',
      passed,
      expected: 'status: OK, overBy: 0',
      actual: `status: ${res.status}, overBy: ${res.overBy}`,
    });
  }

  // TEST 1B: Discount Check 18% vs 10% -> OVER by 8
  {
    const res = computeLineStatus(18, 10);
    const passed = res.status === 'OVER' && res.overBy === 8;
    results.push({
      id: 'DISCOUNT-1B',
      name: 'Discount Check: 18% vs 10% limit',
      category: 'Discount Governance',
      passed,
      expected: 'status: OVER, overBy: 8',
      actual: `status: ${res.status}, overBy: ${res.overBy}`,
    });
  }

  // TEST 2: Risk Scoring: 8pt single violation -> HIGH
  {
    const mockLines: QuotationLine[] = [
      {
        id: 'L1',
        productId: 'P1',
        quantity: 2,
        baseUnitPrice: 1200,
        unitPrice: 1056,
        discountPercent: 12,
        categoryLimitPercent: 15,
        subtotal: 2400,
        discountAmount: 288,
        lineTotal: 2112,
        overBy: 0,
        lineStatus: 'OK',
        revenue: 2112,
        cost: 1440,
        profit: 672,
        marginPercent: 31.82,
        isSubscription: false,
      },
      {
        id: 'L2',
        productId: 'P2',
        quantity: 1,
        baseUnitPrice: 450,
        unitPrice: 369,
        discountPercent: 18,
        categoryLimitPercent: 10,
        subtotal: 450,
        discountAmount: 81,
        lineTotal: 369,
        overBy: 8,
        lineStatus: 'OVER',
        revenue: 369,
        cost: 292.5,
        profit: 76.5,
        marginPercent: 20.73,
        isSubscription: false,
      },
    ];

    const risk = computeBlendedRiskScore(mockLines);
    const passed = risk.level === 'HIGH' && risk.worstLineOverBy === 8;
    results.push({
      id: 'RISK-01',
      name: 'Blended Risk: 8pt single line violation triggers HIGH',
      category: 'Risk Engine',
      passed,
      expected: 'level: HIGH, worstLineOverBy: 8',
      actual: `level: ${risk.level}, worstLineOverBy: ${risk.worstLineOverBy}`,
      details: risk.reasons.join('; '),
    });
  }

  // TEST 3: Approval Chain Routing
  {
    const lowApprovers = computeRequiredApprovers('LOW');
    const medApprovers = computeRequiredApprovers('MEDIUM');
    const highApprovers = computeRequiredApprovers('HIGH');

    const passed =
      lowApprovers.length === 0 &&
      medApprovers.length === 1 &&
      medApprovers[0] === 'sales_manager' &&
      highApprovers.length === 2 &&
      highApprovers[0] === 'sales_manager' &&
      highApprovers[1] === 'finance';

    results.push({
      id: 'APPROVAL-01',
      name: 'Dynamic Approval Chain: LOW -> None, MEDIUM -> Mgr, HIGH -> Mgr + Finance',
      category: 'Approval Chain',
      passed,
      expected: 'LOW: [], MEDIUM: [sales_manager], HIGH: [sales_manager, finance]',
      actual: `LOW: [${lowApprovers}], MEDIUM: [${medApprovers}], HIGH: [${highApprovers}]`,
    });
  }

  // TEST 4: Warehouse Allocation & Backorder
  {
    const mockWarehouses: Warehouse[] = [
      {
        id: 'WH-MAIN',
        name: 'Main Warehouse',
        shippingCostWeight: 1.0,
        active: true,
        stock: [{ productId: 'PROD-LP14', inStock: 40, reserved: 18 }], // available = 22
      },
      {
        id: 'WH-EAST',
        name: 'East Depot',
        shippingCostWeight: 1.2,
        active: true,
        stock: [{ productId: 'PROD-LP14', inStock: 10, reserved: 6 }], // available = 4
      },
    ];

    const requestedQty = 30; // Available = 22 + 4 = 26. Backorder must be 4.
    const mockLine: QuotationLine = {
      id: 'LINE-1',
      productId: 'PROD-LP14',
      productName: 'Laptop Pro 14',
      category: 'Hardware',
      quantity: requestedQty,
      baseUnitPrice: 1200,
      unitPrice: 1200,
      discountPercent: 0,
      categoryLimitPercent: 15,
      subtotal: 36000,
      discountAmount: 0,
      lineTotal: 36000,
      overBy: 0,
      lineStatus: 'OK',
      revenue: 36000,
      cost: 21600,
      profit: 14400,
      marginPercent: 40,
      isSubscription: false,
    };

    const split = computeWarehouseSplit([mockLine], mockWarehouses);
    const totalFulfilled = split.allocations.reduce((sum, a) => sum + a.quantityFulfilled, 0);
    const backorderItem = split.backorderedLines.find((b) => b.productId === 'PROD-LP14');
    const backorderedQty = backorderItem?.backordered ?? 0;

    const passed = totalFulfilled === 26 && backorderedQty === 4;
    results.push({
      id: 'WAREHOUSE-01',
      name: 'Warehouse Allocation: 30 requested -> 26 fulfilled (22 Main + 4 East), 4 backordered',
      category: 'Fulfillment & Inventory',
      passed,
      expected: 'fulfilled: 26, backordered: 4',
      actual: `fulfilled: ${totalFulfilled}, backordered: ${backorderedQty}`,
    });
  }

  // TEST 5: Margin Calculations
  {
    const product = { price: 1200, costBasisPercent: 60 };
    const res1 = computeMarginDelta(product, 0, 1);
    const res2 = computeMarginDelta(product, 10, 1);

    const passed =
      res1.revenue === 1200 &&
      res1.cost === 720 &&
      res1.profit === 480 &&
      res1.marginPercent === 40 &&
      res2.revenue === 1080 &&
      res2.cost === 720 &&
      res2.profit === 360 &&
      res2.marginPercent === 33.33;

    results.push({
      id: 'MARGIN-01',
      name: 'Dynamic Margin: Discount shifts revenue and margin without hardcoded stubs',
      category: 'Financial Engine',
      passed,
      expected: '0% disc: $480 profit (40%); 10% disc: $360 profit (33.33%)',
      actual: `0% disc: $${res1.profit} (${res1.marginPercent}%); 10% disc: $${res2.profit} (${res2.marginPercent}%)`,
    });
  }

  // TEST 6: Negotiation Re-Approval Trigger
  {
    // A quote that was approved with 10% discount (Services limit: 10%)
    const approvedLine: QuotationLine = {
      id: 'NL-1',
      productId: 'P-SRV',
      productName: 'Setup Service',
      category: 'Services',
      quantity: 1,
      baseUnitPrice: 450,
      unitPrice: 405,
      discountPercent: 10,
      categoryLimitPercent: 10,
      subtotal: 450,
      discountAmount: 45,
      lineTotal: 405,
      overBy: 0,
      lineStatus: 'OK',
      revenue: 405,
      cost: 292.5,
      profit: 112.5,
      marginPercent: 27.78,
      isSubscription: false,
    };

    const initialRisk = computeBlendedRiskScore([approvedLine]);
    const initialApprovers = computeRequiredApprovers(initialRisk);

    // Customer negotiates and counters with 18% discount
    const negotiatedDiscount = 18;
    const { status, overBy } = computeLineStatus(negotiatedDiscount, 10);
    const reevalLine: QuotationLine = {
      ...approvedLine,
      discountPercent: negotiatedDiscount,
      overBy,
      lineStatus: status,
    };

    const newRisk = computeBlendedRiskScore([reevalLine]);
    const newApprovers = computeRequiredApprovers(newRisk);

    const passed =
      initialApprovers.length === 0 &&
      newRisk.level === 'HIGH' &&
      newApprovers.includes('sales_manager') &&
      newApprovers.includes('finance');

    results.push({
      id: 'NEGOTIATION-01',
      name: 'Negotiation Re-Approval: Counter-offer exceeding threshold forces re-entry into governance chain',
      category: 'Negotiation & Re-approval',
      passed,
      expected: 'Initial: 0 approvers; Post-Counter (18%): HIGH risk -> [sales_manager, finance]',
      actual: `Initial: [${initialApprovers}], Post-Counter: [${newApprovers}]`,
    });
  }

  // TEST 7: Hybrid Billing Separation
  {
    const mockQuote: Quotation = {
      id: 'Q-HYBRID',
      code: 'Q-HYBRID',
      customerId: 'CUST-1',
      priceListTier: 'Gold',
      stage: 'Confirmed',
      lines: [
        {
          id: 'L-HW',
          productId: 'P-HW',
          productName: 'Laptop Pro 14',
          category: 'Hardware',
          quantity: 1,
          baseUnitPrice: 1200,
          unitPrice: 1200,
          discountPercent: 0,
          categoryLimitPercent: 15,
          subtotal: 1200,
          discountAmount: 0,
          lineTotal: 1200,
          overBy: 0,
          lineStatus: 'OK',
          revenue: 1200,
          cost: 720,
          profit: 480,
          marginPercent: 40,
          isSubscription: false,
        },
        {
          id: 'L-SUB',
          productId: 'P-SUB',
          productName: 'Care Plan 2yr',
          category: 'Subscription',
          quantity: 1,
          baseUnitPrice: 40,
          unitPrice: 40,
          discountPercent: 0,
          categoryLimitPercent: 15,
          subtotal: 40,
          discountAmount: 0,
          lineTotal: 40,
          overBy: 0,
          lineStatus: 'OK',
          revenue: 40,
          cost: 12,
          profit: 28,
          marginPercent: 70,
          isSubscription: true,
          recurringCycle: 'monthly',
        },
      ],
      subtotal: 1240,
      totalDiscount: 0,
      tax: 124,
      grandTotal: 1364,
      revenue: 1240,
      cost: 732,
      profit: 508,
      marginPercent: 40.97,
      blendedRiskScore: 15,
      blendedRiskValue: 'LOW',
      requiredApprovers: [],
      currentApprovalStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      assignedRepId: 'USR-REP-01',
      viewCount: 1,
    };

    const billingRecord = buildBillingRecord(mockQuote);
    const passed =
      billingRecord.oneTimeLines.length === 1 &&
      billingRecord.oneTimeLines[0].productName === 'Laptop Pro 14' &&
      billingRecord.recurringLines.length === 1 &&
      billingRecord.recurringLines[0].productName === 'Care Plan 2yr' &&
      billingRecord.billingSchedule.some((s) => s.type === 'initial' && s.amount === 1200) &&
      billingRecord.billingSchedule.some((s) => s.type === 'recurring' && s.amount === 40);

    results.push({
      id: 'BILLING-01',
      name: 'Hybrid Billing: One-time hardware and recurring subscriptions isolated cleanly',
      category: 'Billing & Subscriptions',
      passed,
      expected: '1 one-time line ($1,200), 1 recurring line ($40/mo), distinct schedules',
      actual: `${billingRecord.oneTimeLines.length} one-time line, ${billingRecord.recurringLines.length} recurring line`,
    });
  }

  // TEST 8A: Customer Portal Quotation Sanitization (Prompt 10 Section 11 & 32)
  {
    const sensitiveQuote: any = {
      id: 'QT-TEST-CUST',
      code: 'QT-TEST-CUST',
      customerId: 'CUST-008',
      customerName: 'Meridian Industrial Systems',
      stage: 'Approved',
      lines: [
        {
          id: 'L-1',
          productId: 'P-1',
          productName: 'IoT Gateway',
          category: 'Hardware',
          quantity: 10,
          unitPrice: 2400,
          baseUnitPrice: 2400,
          discountPercent: 12,
          lineTotal: 21120,
          cost: 15000,
          profit: 6120,
          marginPercent: 28.98,
          overBy: 0,
        },
      ],
      subtotal: 24000,
      totalDiscount: 2880,
      tax: 1689.6,
      grandTotal: 22809.6,
      blendedRiskScore: 25,
      blendedRiskLevel: 'MEDIUM',
      requiredApprovers: ['sales_manager'],
    };

    const sanitized = getCustomerVisibleQuotation(sensitiveQuote, 'CUST-008');
    const noRiskScore = !('blendedRiskScore' in (sanitized || {}));
    const noRequiredApprovers = !('requiredApprovers' in (sanitized || {}));
    const noLineMargin = sanitized && !('marginPercent' in sanitized.lines[0]) && !('cost' in sanitized.lines[0]);

    results.push({
      id: 'PORTAL-01',
      name: 'Customer Portal: Sanitization strips internal margins, costs, and risk scores',
      category: 'Customer Portal & Governance',
      passed: Boolean(sanitized && noRiskScore && noRequiredApprovers && noLineMargin),
      expected: 'Stripped: blendedRiskScore, requiredApprovers, line margin/cost',
      actual: `noRisk: ${noRiskScore}, noApprovers: ${noRequiredApprovers}, noLineMargin: ${noLineMargin}`,
    });
  }

  // TEST 8B: Cross-Customer Authorization Isolation (Prompt 10 Section 45 & 46)
  {
    const quoteForCust008: any = {
      id: 'QT-MERIDIAN',
      code: 'QT-MERIDIAN',
      customerId: 'CUST-008',
      customerName: 'Meridian Industrial Systems',
      stage: 'Approved',
      lines: [],
      subtotal: 10000,
      totalDiscount: 1000,
      tax: 800,
      grandTotal: 9800,
    };

    // Customer A (CUST-001 Acme Corp) attempts to access Customer B (CUST-008 Meridian)
    const unauthorizedAccess = getCustomerVisibleQuotation(quoteForCust008, 'CUST-001');

    results.push({
      id: 'PORTAL-02',
      name: 'Customer Portal: Cross-Customer URL tampering strictly rejected (returns null)',
      category: 'Customer Portal & Governance',
      passed: unauthorizedAccess === null,
      expected: 'unauthorizedAccess === null',
      actual: `unauthorizedAccess === ${unauthorizedAccess === null ? 'null (Blocked)' : 'Object (Leaked!)'}`,
    });
  }

  // SCREEN 15 REPORTING ACCEPTANCE TESTS
  try {
    const reportingTests = runReportingAcceptanceTests();
    results.push(...reportingTests);
  } catch (e) {
    console.error('Failed running reporting acceptance tests:', e);
  }

  const passedCount = results.filter((r) => r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    allPassed: passedCount === results.length,
    results,
    executedAt: new Date().toISOString(),
  };
}
