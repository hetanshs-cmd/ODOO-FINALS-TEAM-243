import React, { useState } from 'react';
import { Warehouse, Product } from '../../types';
import { Search, Warehouse as WarehouseIcon, RefreshCw, Plus, PackageCheck } from 'lucide-react';
import { toast } from '../ui/Toast';

export interface WarehouseStockTableProps {
  warehouses: Warehouse[];
  products: Product[];
  onRestock: (warehouseId: string, productId: string, quantity: number) => void;
}

export const WarehouseStockTable: React.FC<WarehouseStockTableProps> = ({
  warehouses,
  products,
  onRestock,
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [restockingKey, setRestockingKey] = useState<string | null>(null);

  // Flatten stock entries across warehouses with product details
  const flatStockEntries = warehouses.flatMap((wh) => {
    return wh.stock.map((stk) => {
      const prod = products.find((p) => p.id === stk.productId);
      const available = Math.max(0, stk.inStock - stk.reserved);
      return {
        warehouseId: wh.id,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        warehouseCity: wh.city,
        shippingCostWeight: wh.shippingCostWeight || 1.0,
        productId: stk.productId,
        productName: prod?.name || stk.productId,
        productCategory: prod?.category || 'Hardware',
        inStock: stk.inStock,
        reserved: stk.reserved,
        available,
      };
    });
  });

  const filteredEntries = flatStockEntries.filter((entry) => {
    if (selectedWarehouseId !== 'all' && entry.warehouseId !== selectedWarehouseId) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        entry.productId.toLowerCase().includes(term) ||
        entry.productName.toLowerCase().includes(term) ||
        entry.warehouseName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Calculate summary metrics
  const totalInStock = filteredEntries.reduce((sum, e) => sum + e.inStock, 0);
  const totalReserved = filteredEntries.reduce((sum, e) => sum + e.reserved, 0);
  const totalAvailable = filteredEntries.reduce((sum, e) => sum + e.available, 0);

  const handleQuickRestock = (warehouseId: string, productId: string, productName: string, warehouseName: string) => {
    const key = `${warehouseId}_${productId}`;
    setRestockingKey(key);
    onRestock(warehouseId, productId, 25);
    setTimeout(() => {
      setRestockingKey(null);
      toast.success(
        'Inventory Restocked',
        `Added +25 units of ${productName} to ${warehouseName}.`
      );
    }, 200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-xs">
      {/* Control Strip */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <WarehouseIcon className="w-4 h-4 text-[#714B67]" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Warehouse Inventory Matrix
            </span>
          </div>

          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#714B67] focus:border-[#714B67] outline-none"
          >
            <option value="all">All Facilities ({warehouses.length})</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by SKU, name, warehouse..."
              className="text-xs border border-slate-300 rounded pl-8 pr-3 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-[#714B67] outline-none w-56"
            />
          </div>

          {/* Quick Metrics Pills */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono border-l border-slate-200 pl-3">
            <span className="text-slate-600">
              Total In Stock: <strong className="text-slate-900">{totalInStock}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700">
              Reserved: <strong>{totalReserved}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-bold">
              Available: <strong>{totalAvailable}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Stock Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3.5">Product SKU & Name</th>
              <th className="py-2.5 px-3.5">Warehouse Location</th>
              <th className="py-2.5 px-3.5 text-right">In Stock</th>
              <th className="py-2.5 px-3.5 text-right">Reserved</th>
              <th className="py-2.5 px-3.5 text-right font-bold text-slate-900">Available</th>
              <th className="py-2.5 px-3.5 text-center">Shipping Cost Weight</th>
              <th className="py-2.5 px-3.5 text-center">Operational Simulation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-normal">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                  No stock records matched the selected warehouse or search filter.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const isRestocking = restockingKey === `${entry.warehouseId}_${entry.productId}`;
                const isPrimary = entry.shippingCostWeight <= 1.0;
                const isZeroAvailable = entry.available === 0;

                return (
                  <tr
                    key={`${entry.warehouseId}_${entry.productId}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3.5">
                      <div className="font-mono text-slate-900 font-semibold">{entry.productId}</div>
                      <div className="text-[11px] text-slate-600">{entry.productName}</div>
                    </td>

                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                        {entry.warehouseName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {entry.warehouseCity} ({entry.warehouseCode})
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                      {entry.inStock}
                    </td>

                    <td className="py-2.5 px-3.5 text-right font-mono text-amber-700">
                      {entry.reserved > 0 ? (
                        <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                          {entry.reserved}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3.5 text-right font-mono font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          isZeroAvailable
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : entry.available <= 20
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {entry.available}
                      </span>
                    </td>

                    <td className="py-2.5 px-3.5 text-center font-mono">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                          isPrimary
                            ? 'bg-purple-50 text-purple-900 border border-purple-200 font-semibold'
                            : 'text-slate-600 bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {entry.shippingCostWeight.toFixed(1)}x
                        {isPrimary && ' (Priority)'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickRestock(
                            entry.warehouseId,
                            entry.productId,
                            entry.productName,
                            entry.warehouseName
                          )
                        }
                        disabled={isRestocking}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs active:scale-98 cursor-pointer disabled:opacity-50"
                        title="Simulate inbound restock of 25 units to this facility"
                      >
                        {isRestocking ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                        ) : (
                          <Plus className="w-3 h-3 text-emerald-600" />
                        )}
                        Restock +25
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info Strip */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-3.5 h-3.5 text-[#714B67]" />
          <span>
            Real-time stock formula enforced: <code>Available = In Stock - Reserved</code>. Allocating orders automatically increments reservations.
          </span>
        </div>
        <div className="font-mono text-slate-400 text-[10px]">
          Live Inventory Ledger • Multi-Facility Operational Mode
        </div>
      </div>
    </div>
  );
};
