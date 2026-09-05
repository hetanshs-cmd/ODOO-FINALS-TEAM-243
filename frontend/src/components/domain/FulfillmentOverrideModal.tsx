import React, { useState, useEffect } from 'react';
import { Warehouse, Quotation, WarehouseSplitAllocation } from '../../types';
import { X, AlertTriangle, CheckCircle2, ShieldAlert, Truck, DollarSign, Warehouse as WarehouseIcon } from 'lucide-react';
import { getWarehouseAvailableStock, validateWarehouseOverride } from '../../domain/fulfillment';
import { toast } from '../ui/Toast';

export interface FulfillmentOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  warehouses: Warehouse[];
  currentAllocations: WarehouseSplitAllocation[];
  onSaveOverride: (allocations: WarehouseSplitAllocation[]) => void;
  canOverride: boolean;
  permissionReason?: string;
}

export const FulfillmentOverrideModal: React.FC<FulfillmentOverrideModalProps> = ({
  isOpen,
  onClose,
  quotation,
  warehouses,
  currentAllocations,
  onSaveOverride,
  canOverride,
  permissionReason,
}) => {
  // Physical lines only
  const physicalLines = quotation.lines.filter(
    (l) => l.category === 'Hardware' && !l.isSubscription
  );

  // State: map of `${warehouseId}_${productId}` -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, number> = {};
      // Seed with existing allocations or 0
      for (const line of physicalLines) {
        for (const w of warehouses) {
          const key = `${w.id}_${line.productId}`;
          const existing = currentAllocations.find(
            (a) => a.warehouseId === w.id && a.productId === line.productId
          );
          initialMap[key] = existing ? existing.quantityFulfilled : 0;
        }
      }
      setQuantities(initialMap);
    }
  }, [isOpen, quotation, warehouses, currentAllocations]);

  if (!isOpen) return null;

  const handleQuantityChange = (warehouseId: string, productId: string, val: string) => {
    const parsed = parseInt(val, 10);
    const key = `${warehouseId}_${productId}`;
    setQuantities((prev) => ({
      ...prev,
      [key]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  // Run validation per physical line item
  const lineEvaluations = physicalLines.map((line) => {
    const requested = line.quantity;
    const warehouseBreakdown = warehouses.map((w) => {
      const key = `${w.id}_${line.productId}`;
      const qty = quantities[key] || 0;
      const available = getWarehouseAvailableStock(w, line.productId);
      const isOverCapacity = qty > available;
      return {
        warehouse: w,
        qty,
        available,
        isOverCapacity,
      };
    });

    const totalAllocated = warehouseBreakdown.reduce((sum, item) => sum + item.qty, 0);
    const remaining = requested - totalAllocated;
    const isUnder = totalAllocated < requested;
    const isOver = totalAllocated > requested;
    const hasCapacityViolation = warehouseBreakdown.some((item) => item.isOverCapacity);

    return {
      line,
      requested,
      totalAllocated,
      remaining,
      isUnder,
      isOver,
      hasCapacityViolation,
      warehouseBreakdown,
    };
  });

  const hasAnyCapacityViolation = lineEvaluations.some((le) => le.hasCapacityViolation);
  const hasAnyQuantityMismatch = lineEvaluations.some((le) => le.isUnder || le.isOver);
  const isValid = !hasAnyCapacityViolation && !hasAnyQuantityMismatch;

  // Build proposed allocations and recompute estimated freight/shipments
  const proposedAllocations: WarehouseSplitAllocation[] = [];
  for (const le of lineEvaluations) {
    for (const wb of le.warehouseBreakdown) {
      if (wb.qty > 0) {
        const baseFreight = Number((120 * (wb.warehouse.shippingCostWeight || 1.0)).toFixed(2));
        const handling = Number((wb.qty * 3.5).toFixed(2));
        proposedAllocations.push({
          warehouseId: wb.warehouse.id,
          warehouseName: wb.warehouse.name,
          productId: le.line.productId,
          quantityFulfilled: wb.qty,
          estimatedShipments: 1,
          shippingCost: baseFreight,
          handlingCost: handling,
          totalCost: Number((baseFreight + handling).toFixed(2)),
        });
      }
    }
  }

  const uniqueWarehouses = new Set(proposedAllocations.map((a) => a.warehouseId));
  const totalShipments = uniqueWarehouses.size;
  const totalCost = proposedAllocations.reduce((sum, a) => sum + (a.totalCost || 0), 0);

  const handleApply = () => {
    if (!canOverride) {
      toast.error('Permission Denied', permissionReason || 'Unauthorized to apply override.');
      return;
    }

    if (!isValid) {
      toast.error('Validation Error', 'Please resolve allocation violations before saving.');
      return;
    }

    try {
      onSaveOverride(proposedAllocations);
      toast.success(
        'Manual Override Applied',
        `Fulfillment plan updated across ${totalShipments} facility location(s).`
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply manual override.';
      toast.error('Override Error', msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-[#714B67]" />
              Manual Warehouse Allocation Override
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Order <span className="font-mono font-semibold text-slate-700">{quotation.code}</span> — {quotation.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* RBAC Warning Banner if user cannot override */}
          {!canOverride && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">View Only Mode</div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {permissionReason || 'Warehouse allocation overrides require Operations or Finance authorization.'}
                </div>
              </div>
            </div>
          )}

          {/* Allocation Lines */}
          {lineEvaluations.map((le) => (
            <div
              key={le.line.id}
              className="border border-slate-200 rounded-sm bg-white overflow-hidden"
            >
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {le.line.productId}
                  </span>
                  <span className="text-slate-600 text-xs ml-2">
                    {le.line.productName}
                  </span>
                </div>
                <div className="text-xs font-mono">
                  Required Quantity:{' '}
                  <strong className="text-slate-900">{le.requested} units</strong>
                </div>
              </div>

              {/* Warehouse rows */}
              <div className="divide-y divide-slate-100">
                {le.warehouseBreakdown.map((item) => {
                  const key = `${item.warehouse.id}_${le.line.productId}`;
                  return (
                    <div
                      key={item.warehouse.id}
                      className={`p-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
                        item.isOverCapacity ? 'bg-rose-50/70' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-medium text-slate-800">
                          {item.warehouse.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.warehouse.city} • Available Capacity:{' '}
                          <span
                            className={`font-semibold ${
                              item.available > 0 ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {item.available} units
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label
                          htmlFor={`override-${key}`}
                          className="text-[11px] text-slate-500 font-mono"
                        >
                          Allocate:
                        </label>
                        <input
                          id={`override-${key}`}
                          type="number"
                          min="0"
                          max={item.available * 2} // allow typing over to trigger validation
                          disabled={!canOverride}
                          value={item.qty === 0 ? '' : item.qty}
                          placeholder="0"
                          onChange={(e) =>
                            handleQuantityChange(
                              item.warehouse.id,
                              le.line.productId,
                              e.target.value
                            )
                          }
                          className={`w-24 px-2 py-1 text-right text-xs font-mono border rounded outline-none ${
                            item.isOverCapacity
                              ? 'border-rose-400 bg-rose-50 text-rose-900 font-bold ring-1 ring-rose-300'
                              : 'border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-[#714B67]'
                          }`}
                        />
                      </div>

                      {item.isOverCapacity && (
                        <div className="w-full text-right text-[11px] font-semibold text-rose-700">
                          Exceeds available stock by {item.qty - item.available} units (Available: {item.available})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Line Summary Status */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span>
                    Allocated:{' '}
                    <strong
                      className={
                        le.isUnder || le.isOver
                          ? 'text-rose-700'
                          : 'text-emerald-700 font-bold'
                      }
                    >
                      {le.totalAllocated}
                    </strong>{' '}
                    / {le.requested}
                  </span>
                </div>

                <div>
                  {le.isUnder && (
                    <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-sans font-medium">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Under-allocation: {le.remaining} units remaining to assign
                    </span>
                  )}
                  {le.isOver && (
                    <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px] font-sans font-medium">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Over-allocation: exceeds required quantity by {Math.abs(le.remaining)} units
                    </span>
                  )}
                  {!le.isUnder && !le.isOver && !le.hasCapacityViolation && (
                    <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-sans font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Allocation exact ({le.requested}/{le.requested})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Recomputed Logistics Impact */}
          <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-4 text-slate-700">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Active Facilities:{' '}
                <strong className="text-slate-900">{totalShipments}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Est. Freight & Handling:{' '}
                <strong className="text-slate-900">
                  ₹{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </span>
            </div>

            <div className="text-[11px] text-slate-500 font-sans">
              Shipments calculated per active shipping facility
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!isValid || !canOverride}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[#714B67] hover:bg-[#5E3E56] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            Apply Override & Reserve Stock
          </button>
        </div>
      </div>
    </div>
  );
};
