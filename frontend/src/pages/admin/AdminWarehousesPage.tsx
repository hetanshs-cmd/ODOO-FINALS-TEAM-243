import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import { Warehouse } from '../../types';
import {
  Truck,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  MapPin,
  Package,
  Layers,
  Sparkles,
  Save,
  X,
  RefreshCw,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminWarehousesPage: React.FC = () => {
  const { warehouses, products, saveWarehouse, toggleWarehouseActive, restockWarehouse } = useDealStore();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<Warehouse> | null>(null);

  // Quick restock modal
  const [restockItem, setRestockItem] = useState<{ warehouseId: string; productId: string; quantity: number } | null>(null);

  const selectedWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  const handleCreateWarehouse = () => {
    setEditingWarehouse({
      id: `WH-${Date.now()}`,
      code: `WH-REG-${Date.now().toString().slice(-3)}`,
      name: '',
      city: '',
      location: 'Central Industrial District',
      shippingCostWeight: 1.2,
      active: true,
      stock: products.map((p) => ({
        productId: p.id,
        inStock: 50,
        reserved: 0,
      })),
    });
    setIsModalOpen(true);
  };

  const handleEditWarehouse = (wh: Warehouse) => {
    setEditingWarehouse({ ...wh });
    setIsModalOpen(true);
  };

  const handleToggleActive = (wh: Warehouse) => {
    const nextActive = !wh.active;
    toggleWarehouseActive(wh.id, nextActive);
    if (nextActive) {
      toast.success(
        'Warehouse Status Updated',
        `${wh.name} is now Active (Eligible for fulfillment routing).`
      );
    } else {
      toast.warning(
        'Warehouse Status Updated',
        `${wh.name} is now Disabled (Excluded from new allocation splits).`
      );
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editingWarehouse.name || !editingWarehouse.code) return;

    const fullWarehouse: Warehouse = {
      id: editingWarehouse.id || `WH-${Date.now()}`,
      code: editingWarehouse.code,
      name: editingWarehouse.name,
      city: editingWarehouse.city || 'City',
      location: editingWarehouse.location || editingWarehouse.city || 'Regional Depot',
      shippingCostWeight: Number(editingWarehouse.shippingCostWeight) || 1.0,
      active: editingWarehouse.active !== false,
      isPrimary: Boolean(editingWarehouse.isPrimary),
      stock: editingWarehouse.stock || [],
    };

    saveWarehouse(fullWarehouse);
    toast.success(
      'Warehouse Saved',
      `Facility "${fullWarehouse.name}" (${fullWarehouse.code}) saved.`
    );
    setIsModalOpen(false);
    setEditingWarehouse(null);
  };

  const handleQuickRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    restockWarehouse(restockItem.warehouseId, restockItem.productId, restockItem.quantity);
    toast.success(
      'Stock Replenished',
      `Added ${restockItem.quantity} units to inventory at facility.`
    );
    setRestockItem(null);
  };

  return (
    <div id="admin-warehouses-container" className="space-y-4">
      {/* Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Warehouse & Fulfillment Facilities
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {warehouses.length} Regional Facilities
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Configure multi-facility distribution hubs, shipping cost prioritization weights, and active fulfillment routing eligibility.
          </p>
        </div>

        <button
          id="btn-create-warehouse"
          onClick={handleCreateWarehouse}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Facility</span>
        </button>
      </div>

      {/* Real-time Allocation Engine Explanation */}
      <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#065F46] flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#059669] shrink-0" />
        <span>
          <strong>Deterministic Warehouse Routing:</strong> Fulfillment split calculations use active facilities sorted
          by lowest <em>Shipping Cost Weight</em> first. When a warehouse is <strong>Disabled</strong>, the split engine
          immediately excludes it from all new quotation order recommendations!
        </span>
      </div>

      {/* Facilities Overview Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
            Configured Fulfillment Centers
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table id="warehouses-table" className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                <th className="py-2.5 px-4">Facility Code / Name</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4 text-center">Shipping Cost Weight</th>
                <th className="py-2.5 px-4 text-center">Stock Items</th>
                <th className="py-2.5 px-4 text-center">Eligibility Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {warehouses.map((w) => {
                const isActive = w.active !== false;
                const totalStock = w.stock.reduce((sum, s) => sum + s.inStock, 0);
                const totalReserved = w.stock.reduce((sum, s) => sum + s.reserved, 0);

                return (
                  <tr
                    key={w.id}
                    id={`warehouse-row-${w.id}`}
                    className={`hover:bg-[#F9FAFB] transition-colors ${
                      !isActive ? 'opacity-55 bg-[#FAFAFA]' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-[#1F2937] flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[#714B67]" />
                        <span>{w.name}</span>
                        {w.isPrimary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#E0E7FF] text-[#3730A3] rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#6B7280]">{w.code || w.id}</div>
                    </td>

                    <td className="py-2.5 px-4 text-[#374151]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                        <span>
                          {w.city || w.location || 'Central Facility'}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB]">
                        {w.shippingCostWeight || 1.0}x
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span className="text-xs font-mono font-semibold text-[#1F2937]">
                        {totalStock - totalReserved} avail
                      </span>
                      <span className="text-[10px] text-[#6B7280] ml-1">
                        ({totalReserved} rsvd / {totalStock} total)
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <button
                        id={`btn-toggle-wh-${w.id}`}
                        onClick={() => handleToggleActive(w)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] hover:bg-[#D1FAE5]'
                            : 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FCD34D]'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                            <span>Active / Routed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-[#DC2626]" />
                            <span>Disabled / Excluded</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          id={`btn-view-stock-${w.id}`}
                          onClick={() => setSelectedWarehouseId(w.id)}
                          className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                            selectedWarehouse.id === w.id
                              ? 'bg-[#714B67] text-white font-semibold'
                              : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          Stock
                        </button>
                        <button
                          id={`btn-edit-wh-${w.id}`}
                          onClick={() => handleEditWarehouse(w)}
                          className="p-1 text-[#6B7280] hover:text-[#714B67] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Facility Inventory Details */}
      {selectedWarehouse && (
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#714B67]" />
                <span>Inventory Ledger: {selectedWarehouse.name} ({selectedWarehouse.code || selectedWarehouse.id})</span>
              </h3>
              <p className="text-xs text-[#6B7280]">
                Real-time on-hand, reserved, and available physical quantities at this distribution center.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2 px-4">Product Name / SKU</th>
                  <th className="py-2 px-4 text-right">Total In Stock</th>
                  <th className="py-2 px-4 text-right">Reserved (Active Deals)</th>
                  <th className="py-2 px-4 text-right">Available to Promise</th>
                  <th className="py-2 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {products
                  .filter((p) => !p.isSubscription && p.status !== 'Archived')
                  .map((p) => {
                    const stockRecord = selectedWarehouse.stock.find((s) => s.productId === p.id);
                    const inStock = stockRecord?.inStock || 0;
                    const reserved = stockRecord?.reserved || 0;
                    const available = Math.max(0, inStock - reserved);

                    return (
                      <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-2 px-4">
                          <div className="font-semibold text-[#1F2937]">{p.name}</div>
                          <div className="text-[11px] font-mono text-[#6B7280]">{p.sku || p.id}</div>
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-[#1F2937]">
                          {inStock}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-[#9CA3AF]">
                          {reserved}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-[#059669]">
                          {available}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            id={`btn-restock-${selectedWarehouse.id}-${p.id}`}
                            onClick={() =>
                              setRestockItem({
                                warehouseId: selectedWarehouse.id,
                                productId: p.id,
                                quantity: 25,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#714B67] hover:bg-[#F5EEF4] rounded transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Quick Restock</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      {isModalOpen && editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingWarehouse.id ? 'Edit Warehouse Center' : 'New Fulfillment Center'}
                </h3>
              </div>
              <button
                id="btn-close-wh-modal"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Facility Name *
                </label>
                <input
                  id="wh-modal-name"
                  type="text"
                  required
                  value={editingWarehouse.name || ''}
                  onChange={(e) => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })}
                  placeholder="e.g. Pune Regional Hub"
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Facility Code *
                  </label>
                  <input
                    id="wh-modal-code"
                    type="text"
                    required
                    value={editingWarehouse.code || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, code: e.target.value })}
                    placeholder="e.g. WH-PUNE"
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Shipping Cost Weight
                  </label>
                  <input
                    id="wh-modal-weight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editingWarehouse.shippingCostWeight ?? 1.0}
                    onChange={(e) =>
                      setEditingWarehouse({
                        ...editingWarehouse,
                        shippingCostWeight: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    City *
                  </label>
                  <input
                    id="wh-modal-city"
                    type="text"
                    required
                    value={editingWarehouse.city || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Location / Area
                  </label>
                  <input
                    id="wh-modal-location"
                    type="text"
                    value={editingWarehouse.location || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  id="btn-cancel-wh-modal"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="btn-save-wh-modal"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Facility</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Restock Dialog */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
              Replenish Facility Stock
            </h3>
            <p className="text-xs text-[#6B7280]">
              Add units to on-hand physical stock for {products.find((p) => p.id === restockItem.productId)?.name}.
            </p>

            <form onSubmit={handleQuickRestockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Quantity to Add
                </label>
                <input
                  id="input-restock-qty"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={restockItem.quantity}
                  onChange={(e) =>
                    setRestockItem({
                      ...restockItem,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
