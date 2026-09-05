import { describe, expect, it } from 'vitest';
import { allocateAcrossWarehouses } from '../../src/modules/fulfillment/warehouseAllocation';

describe('allocateAcrossWarehouses', () => {
  it('prefers a single warehouse when it can cover every line', () => {
    const result = allocateAcrossWarehouses(
      [
        { salesOrderItemId: 'i1', productId: 'p1', quantity: 5 },
        { salesOrderItemId: 'i2', productId: 'p2', quantity: 3 },
      ],
      [
        { warehouseId: 'w1', productId: 'p1', quantityAvailable: 10 },
        { warehouseId: 'w1', productId: 'p2', quantityAvailable: 10 },
        { warehouseId: 'w2', productId: 'p1', quantityAvailable: 10 },
        { warehouseId: 'w2', productId: 'p2', quantityAvailable: 0 },
      ]
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.warehouseId).toBe('w1');
    expect(result.backorders).toHaveLength(0);
  });

  it('splits across warehouses by descending stock when no single warehouse covers all', () => {
    const result = allocateAcrossWarehouses(
      [{ salesOrderItemId: 'i1', productId: 'p1', quantity: 12 }],
      [
        { warehouseId: 'w1', productId: 'p1', quantityAvailable: 8 },
        { warehouseId: 'w2', productId: 'p1', quantityAvailable: 3 },
      ]
    );

    expect(result.backorders).toEqual([{ salesOrderItemId: 'i1', productId: 'p1', quantity: 1 }]);
    const w1Line = result.allocations.find((a) => a.warehouseId === 'w1')!.items[0]!;
    const w2Line = result.allocations.find((a) => a.warehouseId === 'w2')!.items[0]!;
    expect(w1Line.quantity).toBe(8);
    expect(w2Line.quantity).toBe(3);
  });

  it('backorders the full quantity when no warehouse has any stock', () => {
    const result = allocateAcrossWarehouses(
      [{ salesOrderItemId: 'i1', productId: 'p1', quantity: 4 }],
      [{ warehouseId: 'w1', productId: 'p1', quantityAvailable: 0 }]
    );

    expect(result.allocations).toHaveLength(0);
    expect(result.backorders).toEqual([{ salesOrderItemId: 'i1', productId: 'p1', quantity: 4 }]);
  });

  it('handles multi-item orders independently across warehouses', () => {
    const result = allocateAcrossWarehouses(
      [
        { salesOrderItemId: 'i1', productId: 'p1', quantity: 5 },
        { salesOrderItemId: 'i2', productId: 'p2', quantity: 5 },
      ],
      [
        { warehouseId: 'w1', productId: 'p1', quantityAvailable: 5 },
        { warehouseId: 'w1', productId: 'p2', quantityAvailable: 0 },
        { warehouseId: 'w2', productId: 'p1', quantityAvailable: 0 },
        { warehouseId: 'w2', productId: 'p2', quantityAvailable: 5 },
      ]
    );

    expect(result.allocations).toHaveLength(2);
    expect(result.backorders).toHaveLength(0);
  });
});
