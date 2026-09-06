/**
 * Pure greedy warehouse-allocation algorithm — no DB/HTTP imports, so it can
 * be unit-tested in isolation before being wired to the allocate endpoint
 * (same pure-function-first approach as discount-engine/discountEngine.ts).
 *
 * Strategy (docs/development-workflow.md Block 3 — "greedy allocation,
 * minimize shipment count, backorder remainder"):
 *   1. If a single warehouse can fully cover every line item, use it alone
 *      (minimizes shipment count to exactly one).
 *   2. Otherwise, per item, draw from warehouses in descending available-
 *      stock order until the item is covered or stock runs out; whatever
 *      is left unmet becomes a backorder for that item.
 */

export interface OrderItemToAllocate {
  salesOrderItemId: string;
  productId: string;
  quantity: number;
}

export interface InventoryRow {
  warehouseId: string;
  productId: string;
  quantityAvailable: number;
}

export interface WarehouseAllocationLine {
  salesOrderItemId: string;
  productId: string;
  quantity: number;
}

export interface WarehouseAllocation {
  warehouseId: string;
  items: WarehouseAllocationLine[];
}

export interface BackorderLine {
  salesOrderItemId: string;
  productId: string;
  quantity: number;
}

export interface AllocationResult {
  allocations: WarehouseAllocation[];
  backorders: BackorderLine[];
}

function availabilityByWarehouse(inventory: InventoryRow[]): Map<string, Map<string, number>> {
  const byWarehouse = new Map<string, Map<string, number>>();
  for (const row of inventory) {
    if (!byWarehouse.has(row.warehouseId)) byWarehouse.set(row.warehouseId, new Map());
    byWarehouse.get(row.warehouseId)!.set(row.productId, row.quantityAvailable);
  }
  return byWarehouse;
}

/** Total quantity demanded per product across every order line. */
function demandByProduct(items: OrderItemToAllocate[]): Map<string, number> {
  const demand = new Map<string, number>();
  for (const item of items) {
    demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity);
  }
  return demand;
}

function findSingleWarehouseCoveringAll(
  items: OrderItemToAllocate[],
  byWarehouse: Map<string, Map<string, number>>,
): string | null {
  // Compare warehouse stock against the SUMMED demand per product, not each
  // line independently — otherwise two lines of the same product (6 + 6)
  // each pass against a stock of 10 and the warehouse is picked even though
  // it only holds 10 of the 12 required, over-reserving inventory downstream.
  const demand = demandByProduct(items);
  for (const [warehouseId, stock] of byWarehouse) {
    const coversAll = [...demand.entries()].every(
      ([productId, qty]) => (stock.get(productId) ?? 0) >= qty,
    );
    if (coversAll) return warehouseId;
  }
  return null;
}

export function allocateAcrossWarehouses(
  items: OrderItemToAllocate[],
  inventory: InventoryRow[],
): AllocationResult {
  const byWarehouse = availabilityByWarehouse(inventory);

  const singleWarehouseId = findSingleWarehouseCoveringAll(items, byWarehouse);
  if (singleWarehouseId) {
    return {
      allocations: [
        {
          warehouseId: singleWarehouseId,
          items: items.map((item) => ({
            salesOrderItemId: item.salesOrderItemId,
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      ],
      backorders: [],
    };
  }

  // Deep copy: the greedy loop below decrements per-warehouse stock as it
  // consumes it, and must not mutate the caller's inventory view.
  const remaining = new Map(
    [...byWarehouse].map(([warehouseId, stock]) => [warehouseId, new Map(stock)] as const),
  );
  const perWarehouseLines = new Map<string, WarehouseAllocationLine[]>();
  const backorders: BackorderLine[] = [];

  for (const item of items) {
    let outstanding = item.quantity;

    const candidateWarehouses = [...remaining.entries()]
      .filter(([, stock]) => (stock.get(item.productId) ?? 0) > 0)
      .sort((a, b) => (b[1].get(item.productId) ?? 0) - (a[1].get(item.productId) ?? 0));

    for (const [warehouseId, stock] of candidateWarehouses) {
      if (outstanding <= 0) break;
      const available = stock.get(item.productId) ?? 0;
      const take = Math.min(available, outstanding);
      if (take <= 0) continue;

      stock.set(item.productId, available - take);
      outstanding -= take;

      if (!perWarehouseLines.has(warehouseId)) perWarehouseLines.set(warehouseId, []);
      perWarehouseLines.get(warehouseId)!.push({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        quantity: take,
      });
    }

    if (outstanding > 0) {
      backorders.push({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        quantity: outstanding,
      });
    }
  }

  const allocations: WarehouseAllocation[] = [...perWarehouseLines.entries()].map(
    ([warehouseId, lines]) => ({ warehouseId, items: lines }),
  );

  return { allocations, backorders };
}
