/**
 * DealFlow360 — Multi-Warehouse Fulfillment & Backorder Allocation Engine
 * Deterministic greedy allocation, manual override validation, explainability, and backorder consolidation.
 */

import {
  Warehouse,
  Quotation,
  QuotationLine,
  WarehouseSplitAllocation,
  WarehouseSplitResult,
} from '../../types';

/**
 * Calculates dynamically available stock for a product in a warehouse.
 * Rule: available = inStock - reserved
 */
export function getWarehouseAvailableStock(warehouse: Warehouse, productId: string): number {
  const stockRecord = warehouse.stock.find((s) => s.productId === productId);
  if (!stockRecord) return 0;
  return Math.max(0, stockRecord.inStock - stockRecord.reserved);
}

/**
 * Core Function: Compute Warehouse Split
 *
 * Greedy allocation strategy:
 * 1. Fulfill required quantity using warehouses sorted by shippingCostWeight ascending.
 * 2. If available stock across all warehouses < requested quantity, create backorder.
 * 3. Minimizes shipments by consolidating lines into common regional facilities.
 */
export function computeWarehouseSplit(
  lines: QuotationLine[],
  warehouses: Warehouse[]
): WarehouseSplitResult {
  // Sort active warehouses by shipping cost weight (lowest cost first, e.g. Main Warehouse / Mumbai)
  const sortedWarehouses = [...warehouses]
    .filter((w) => w.active !== false)
    .sort((a, b) => (a.shippingCostWeight || 1) - (b.shippingCostWeight || 1));

  const allocations: WarehouseSplitAllocation[] = [];
  const backorderedLines: WarehouseSplitResult['backorderedLines'] = [];

  // Track temporary remaining available stock during allocation run
  const remainingStockMap = new Map<string, number>();
  for (const w of sortedWarehouses) {
    for (const item of w.stock) {
      remainingStockMap.set(`${w.id}_${item.productId}`, Math.max(0, item.inStock - item.reserved));
    }
  }

  let totalUnitsRequested = 0;
  let totalUnitsFulfilled = 0;

  for (const line of lines) {
    // Only physical hardware/goods require warehouse fulfillment
    if (line.category === 'Services' || line.isSubscription) {
      continue;
    }

    totalUnitsRequested += line.quantity;
    let remainingNeeded = line.quantity;
    let fulfilledForLine = 0;

    for (const warehouse of sortedWarehouses) {
      if (remainingNeeded <= 0) break;

      const key = `${warehouse.id}_${line.productId}`;
      const available = remainingStockMap.get(key) || 0;

      if (available > 0) {
        const allocateQty = Math.min(remainingNeeded, available);
        remainingStockMap.set(key, available - allocateQty);
        remainingNeeded -= allocateQty;
        fulfilledForLine += allocateQty;
        totalUnitsFulfilled += allocateQty;

        // Configured shipping formula: Base freight ($120 * weight) + Handling ($3.50 * qty)
        const baseFreight = Number((120 * (warehouse.shippingCostWeight || 1.0)).toFixed(2));
        const handling = Number((allocateQty * 3.5).toFixed(2));
        const totalLineCost = Number((baseFreight + handling).toFixed(2));

        allocations.push({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          productId: line.productId,
          quantityFulfilled: allocateQty,
          estimatedShipments: 1,
          shippingCost: baseFreight,
          handlingCost: handling,
          totalCost: totalLineCost,
        });
      }
    }

    if (remainingNeeded > 0) {
      backorderedLines.push({
        productId: line.productId,
        productName: line.productName || 'Physical SKU',
        requested: line.quantity,
        fulfilled: fulfilledForLine,
        backordered: remainingNeeded,
      });
    }
  }

  // Unique warehouses determine shipment count
  const uniqueWarehouseIds = new Set(allocations.map((a) => a.warehouseId));
  const totalShipments = uniqueWarehouseIds.size;

  const totalShippingCost = allocations.reduce((sum, a) => sum + a.shippingCost, 0);
  const totalHandlingCost = allocations.reduce((sum, a) => sum + (a.handlingCost || 0), 0);
  const estimatedCost = Number((totalShippingCost + totalHandlingCost).toFixed(2));

  // Determine explainable strategy label
  const strategy =
    backorderedLines.length > 0
      ? 'Multi-Warehouse Split with Backorder'
      : uniqueWarehouseIds.size > 1
      ? 'Optimized Regional Multi-Facility Split'
      : uniqueWarehouseIds.size === 1
      ? 'Primary Facility Direct Ship'
      : 'No Physical Stock Required';

  // Generate dynamic, explainable reasoning
  let explanation = '';
  if (allocations.length === 0 && backorderedLines.length === 0) {
    explanation = 'This quotation contains no physical hardware items requiring physical warehouse fulfillment.';
  } else if (backorderedLines.length > 0) {
    const totalBackordered = backorderedLines.reduce((sum, b) => sum + b.backordered, 0);
    explanation = `Available inventory across all operational warehouses (${totalUnitsFulfilled} units) is insufficient to satisfy the total order (${totalUnitsRequested} units). The engine allocated the maximum available inventory (${totalUnitsFulfilled} units) across ${totalShipments} facility and registered ${totalBackordered} units as an operational backorder.`;
  } else if (uniqueWarehouseIds.size === 1) {
    const whName = allocations[0]?.warehouseName || 'Primary Facility';
    explanation = `${whName} has sufficient available inventory to fulfill the entire order (${totalUnitsRequested} units) in a single consolidated shipment, minimizing handling fees and regional transit times.`;
  } else {
    const allocationSummary = allocations
      .map((a) => `${a.warehouseName} supplies ${a.quantityFulfilled} units`)
      .join('. ');
    explanation = `No single warehouse has enough available stock to fulfill all ${totalUnitsRequested} units. ${allocationSummary}. This allocation completes the order in ${totalShipments} shipments while minimizing configured fulfillment cost.`;
  }

  return {
    strategy,
    allocations,
    totalShipments,
    estimatedCost,
    explanation,
    costBreakdown: {
      shippingCost: totalShippingCost,
      handlingCost: totalHandlingCost,
      totalFulfillmentCost: estimatedCost,
    },
    backorderedLines,
  };
}

export interface OverrideValidationError {
  isValid: boolean;
  errorMessage?: string;
  warehouseId?: string;
  productId?: string;
  requested?: number;
  available?: number;
}

/**
 * Validates manual warehouse override allocations against actual warehouse available stock.
 */
export function validateWarehouseOverride(
  allocations: { warehouseId: string; productId: string; quantity: number }[],
  warehouses: Warehouse[]
): OverrideValidationError {
  for (const alloc of allocations) {
    const warehouse = warehouses.find((w) => w.id === alloc.warehouseId);
    if (!warehouse) {
      return {
        isValid: false,
        errorMessage: `Warehouse ${alloc.warehouseId} does not exist.`,
      };
    }

    const available = getWarehouseAvailableStock(warehouse, alloc.productId);
    if (alloc.quantity > available) {
      return {
        isValid: false,
        errorMessage: `${warehouse.name} only has ${available} available units (requested: ${alloc.quantity}). Exceeds available stock by ${alloc.quantity - available}.`,
        warehouseId: warehouse.id,
        productId: alloc.productId,
        requested: alloc.quantity,
        available,
      };
    }
  }

  return { isValid: true };
}

/**
 * Consolidate Remaining Backorder
 * When inbound purchase orders or stock arrival events occur, reallocates backorders.
 */
export function consolidateBackorder(
  productId: string,
  arrivingQuantity: number,
  targetWarehouseId: string,
  warehouses: Warehouse[],
  currentBackorders: WarehouseSplitResult['backorderedLines']
): {
  updatedWarehouses: Warehouse[];
  remainingBackorders: WarehouseSplitResult['backorderedLines'];
  allocatedQuantity: number;
  message: string;
} {
  const targetWarehouse = warehouses.find((w) => w.id === targetWarehouseId) || warehouses[0];
  const backorderIndex = currentBackorders.findIndex((b) => b.productId === productId);

  if (backorderIndex === -1) {
    return {
      updatedWarehouses: warehouses,
      remainingBackorders: currentBackorders,
      allocatedQuantity: 0,
      message: 'No active backorders found for this product.',
    };
  }

  const bo = currentBackorders[backorderIndex];
  const fulfillQty = Math.min(bo.backordered, arrivingQuantity);

  // Update target warehouse inventory
  const updatedWarehouses = warehouses.map((w) => {
    if (w.id === targetWarehouse.id) {
      const stock = w.stock.map((s) => {
        if (s.productId === productId) {
          return {
            ...s,
            inStock: s.inStock + arrivingQuantity,
            reserved: s.reserved + fulfillQty,
          };
        }
        return s;
      });
      return { ...w, stock };
    }
    return w;
  });

  const remainingBackorderQty = bo.backordered - fulfillQty;
  const remainingBackorders = currentBackorders
    .map((b) => {
      if (b.productId === productId) {
        return {
          ...b,
          fulfilled: b.fulfilled + fulfillQty,
          backordered: remainingBackorderQty,
        };
      }
      return b;
    })
    .filter((b) => b.backordered > 0);

  return {
    updatedWarehouses,
    remainingBackorders,
    allocatedQuantity: fulfillQty,
    message: `Consolidated ${fulfillQty} backordered units at ${targetWarehouse.name}.${
      remainingBackorderQty > 0 ? ` ${remainingBackorderQty} units remain on backorder.` : ' All backorders cleared.'
    }`,
  };
}

/**
 * Detects whether restocked inventory allows a proactive backorder consolidation.
 */
export function detectConsolidationOpportunity(
  backorderedLines: { productId: string; backordered: number }[],
  warehouses: Warehouse[]
): {
  canConsolidate: boolean;
  productId?: string;
  warehouseId?: string;
  warehouseName?: string;
  quantity?: number;
  message?: string;
} | null {
  if (!backorderedLines || backorderedLines.length === 0) return null;

  for (const bo of backorderedLines) {
    if (bo.backordered <= 0) continue;

    for (const w of warehouses) {
      const available = getWarehouseAvailableStock(w, bo.productId);
      if (available >= bo.backordered) {
        return {
          canConsolidate: true,
          productId: bo.productId,
          warehouseId: w.id,
          warehouseName: w.name,
          quantity: bo.backordered,
          message: `${bo.backordered} backordered units can now be fulfilled from ${w.name}. Consolidating here avoids an additional split.`,
        };
      }
    }
  }

  return null;
}

export type FulfillmentBadgeStatus =
  | 'Ready'
  | 'Partially Allocated'
  | 'Allocated'
  | 'Backordered'
  | 'Partially Shipped'
  | 'Shipped';

/**
 * Authoritative Canonical Fulfillment Status Helper.
 * Derives operational status directly from workflow stage, active allocations, and stock availability.
 */
export function getQuotationFulfillmentStatus(
  quotation: Quotation,
  savedSplit?: WarehouseSplitResult,
  warehouses?: Warehouse[]
): {
  status: FulfillmentBadgeStatus;
  label: string;
  variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  backorderCount: number;
  allocatedCount: number;
  totalPhysicalQty: number;
  isAccepted: boolean;
  warehousesUsed: string[];
} {
  const physicalLines = quotation.lines.filter(
    (l) => l.category === 'Hardware' && !l.isSubscription
  );
  const totalPhysicalQty = physicalLines.reduce((sum, l) => sum + l.quantity, 0);

  if (totalPhysicalQty === 0) {
    return {
      status: 'Allocated',
      label: 'Digital / Exempt',
      variant: 'neutral',
      backorderCount: 0,
      allocatedCount: 0,
      totalPhysicalQty: 0,
      isAccepted: true,
      warehousesUsed: [],
    };
  }

  // If already completed/shipped
  if (quotation.stage === 'Completed') {
    return {
      status: 'Shipped',
      label: 'Shipped',
      variant: 'success',
      backorderCount: 0,
      allocatedCount: totalPhysicalQty,
      totalPhysicalQty,
      isAccepted: true,
      warehousesUsed: savedSplit ? savedSplit.allocations.map((a) => a.warehouseName) : [],
    };
  }

  // If an allocation has already been saved/accepted
  if (savedSplit && (quotation.stage === 'Fulfillment' || savedSplit.allocations.length > 0)) {
    const allocatedCount = savedSplit.allocations.reduce((sum, a) => sum + a.quantityFulfilled, 0);
    const backorderCount = savedSplit.backorderedLines.reduce((sum, b) => sum + b.backordered, 0);
    const warehousesUsed = Array.from(new Set(savedSplit.allocations.map((a) => a.warehouseName)));

    if (backorderCount > 0) {
      return {
        status: 'Backordered',
        label: `Partial (${backorderCount} Backordered)`,
        variant: 'warning',
        backorderCount,
        allocatedCount,
        totalPhysicalQty,
        isAccepted: true,
        warehousesUsed,
      };
    }

    return {
      status: 'Allocated',
      label: 'Allocated',
      variant: 'success',
      backorderCount: 0,
      allocatedCount,
      totalPhysicalQty,
      isAccepted: true,
      warehousesUsed,
    };
  }

  // Otherwise, quotation is approved/confirmed but pending allocation
  if (warehouses && warehouses.length > 0) {
    const preview = computeWarehouseSplit(physicalLines, warehouses);
    const backorderCount = preview.backorderedLines.reduce((sum, b) => sum + b.backordered, 0);
    const allocatedCount = preview.allocations.reduce((sum, a) => sum + a.quantityFulfilled, 0);
    const warehousesUsed = Array.from(new Set(preview.allocations.map((a) => a.warehouseName)));

    if (backorderCount > 0) {
      return {
        status: 'Backordered',
        label: `Backordered (${backorderCount} Units)`,
        variant: 'warning',
        backorderCount,
        allocatedCount,
        totalPhysicalQty,
        isAccepted: false,
        warehousesUsed,
      };
    }

    return {
      status: 'Ready',
      label: 'Ready for Allocation',
      variant: 'info',
      backorderCount: 0,
      allocatedCount,
      totalPhysicalQty,
      isAccepted: false,
      warehousesUsed,
    };
  }

  return {
    status: 'Ready',
    label: 'Ready for Allocation',
    variant: 'info',
    backorderCount: 0,
    allocatedCount: 0,
    totalPhysicalQty,
    isAccepted: false,
    warehousesUsed: [],
  };
}
