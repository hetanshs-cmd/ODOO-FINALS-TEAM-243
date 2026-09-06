import React from 'react';
import { Truck, Package, DollarSign } from 'lucide-react';
import { FulfillmentSplit } from '../../types';

export interface WarehouseSplitCardProps {
  splits: FulfillmentSplit[];
  totalQuantityRequired: number;
  onOverride?: () => void;
  className?: string;
}

export const WarehouseSplitCard: React.FC<WarehouseSplitCardProps> = ({
  splits,
  totalQuantityRequired,
  onOverride,
  className = '',
}) => {
  const totalAllocated = splits.reduce((acc, s) => acc + s.quantity, 0);
  const totalEstimatedCost = splits.reduce((acc, s) => acc + s.cost, 0);
  const totalShipments = splits.reduce((acc, s) => acc + s.estimatedShipments, 0);
  const backorderCount = Math.max(0, totalQuantityRequired - totalAllocated);

  return (
    <div className={`bg-white p-4 rounded border border-slate-200 shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Recommended Warehouse Split</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimized to satisfy demand with minimal shipment weight and transit cost.
          </p>
        </div>
        {onOverride && (
          <button
            onClick={onOverride}
            className="text-xs text-blue-900 hover:text-blue-950 font-semibold underline"
          >
            Manual Override
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {splits.map((split, idx) => (
          <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">{split.warehouseName || split.warehouseId}</span>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-900">
                {split.quantity} units
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3 text-slate-400" />
                {split.estimatedShipments} Shipment(s)
              </span>
              <span className="flex items-center gap-0.5 font-mono text-slate-700">
                <DollarSign className="w-3 h-3 text-slate-400" />
                Est. ${split.cost}
              </span>
            </div>
          </div>
        ))}
      </div>

      {backorderCount > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span>Remaining Backorder: <strong>{backorderCount} units</strong></span>
          </div>
          <span className="text-[11px] font-semibold text-amber-700">Pending Inbound Restock</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 font-mono">
        <span>Total Shipments: <strong>{totalShipments}</strong></span>
        <span>Total Freight Cost: <strong>₹{(totalEstimatedCost || 0).toLocaleString()}</strong></span>
      </div>
    </div>
  );
};

export interface StockAvailabilityRowProps {
  warehouseName: string;
  inStock: number;
  reserved: number;
  available: number;
}

export const StockAvailabilityRow: React.FC<StockAvailabilityRowProps> = ({
  warehouseName,
  inStock,
  reserved,
  available,
}) => {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
      <span className="font-medium text-slate-800">{warehouseName}</span>
      <div className="flex items-center gap-4 font-mono">
        <span className="text-slate-500">In Stock: {inStock}</span>
        <span className="text-amber-600">Reserved: {reserved}</span>
        <span className="font-bold text-emerald-700">Available: {available}</span>
      </div>
    </div>
  );
};
