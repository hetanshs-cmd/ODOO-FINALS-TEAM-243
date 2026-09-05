import React, { useState, useEffect, useCallback } from 'react';
import { adminService, isForbiddenError } from '../../services/adminService';
import { ApiWarehouse } from '../../services/apiTypes';
import { ApiError } from '../../services/httpClient';
import {
  Truck,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  MapPin,
  Sparkles,
  Save,
  X,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

// Migrated off the mock store onto the real /admin/warehouses CRUD
// (adminService.warehouses). The mock's per-product stock ledger (Warehouse
// .stock[]) and restock action have no backend equivalent yet — no endpoint
// exists for either per-SKU stock levels on a warehouse or a targeted
// "restock" write (see adminService.isWarehouseRestockSupported()) — so both
// are dropped from this admin screen rather than fabricated or silently
// no-op'd. Facility CRUD (create/edit/toggle) is fully real.
export const AdminWarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<ApiWarehouse> | null>(null);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const data = await adminService.warehouses.list();
      setWarehouses(data);
    } catch (err) {
      if (isForbiddenError(err)) {
        setForbidden(true);
      } else {
        toast.warning('Load Failed', err instanceof ApiError ? err.message : 'Could not load warehouses.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const handleCreateWarehouse = () => {
    setEditingWarehouse({
      name: '',
      code: '',
      location: '',
      shipping_cost_weight: 1.2,
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleEditWarehouse = (wh: ApiWarehouse) => {
    setEditingWarehouse({ ...wh });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (wh: ApiWarehouse) => {
    const nextActive = !wh.active;
    try {
      await adminService.warehouses.update(wh.id, { active: nextActive } as Partial<ApiWarehouse>);
      await loadWarehouses();
      if (nextActive) {
        toast.success('Warehouse Status Updated', `${wh.name} is now Active (Eligible for fulfillment routing).`);
      } else {
        toast.warning('Warehouse Status Updated', `${wh.name} is now Disabled (Excluded from new allocation splits).`);
      }
    } catch (err) {
      toast.warning('Update Failed', err instanceof ApiError ? err.message : 'Could not update warehouse.');
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editingWarehouse.name) return;

    const payload: Partial<ApiWarehouse> = {
      name: editingWarehouse.name,
      code: editingWarehouse.code || null,
      location: editingWarehouse.location || null,
      shipping_cost_weight: Number(editingWarehouse.shipping_cost_weight) || 1.0,
      active: editingWarehouse.active !== false,
    };

    try {
      if (editingWarehouse.id) {
        await adminService.warehouses.update(editingWarehouse.id, payload);
      } else {
        await adminService.warehouses.create(payload);
      }
      await loadWarehouses();
      toast.success('Warehouse Saved', `Facility "${payload.name}" saved.`);
      setIsModalOpen(false);
      setEditingWarehouse(null);
    } catch (err) {
      toast.warning('Save Failed', err instanceof ApiError ? err.message : 'Could not save warehouse.');
    }
  };

  if (forbidden) {
    return (
      <div className="p-6 bg-white rounded-lg border border-[#E5E7EB] text-xs text-[#6B7280]">
        You don't have access to warehouse administration.
      </div>
    );
  }

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
                <th className="py-2.5 px-4 text-center">Eligibility Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#9CA3AF] italic">
                    Loading facilities…
                  </td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#9CA3AF] italic">
                    No facilities configured yet.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => {
                  const isActive = w.active !== false;

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
                        </div>
                        <div className="text-[11px] font-mono text-[#6B7280]">{w.code || w.id}</div>
                      </td>

                      <td className="py-2.5 px-4 text-[#374151]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                          <span>{w.location || '—'}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB]">
                          {w.shipping_cost_weight ?? 1.0}x
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
                        <button
                          id={`btn-edit-wh-${w.id}`}
                          onClick={() => handleEditWarehouse(w)}
                          className="p-1 text-[#6B7280] hover:text-[#714B67] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-product inventory ledger removed — no backend endpoint exists
          for per-SKU stock levels on a warehouse yet. See the Fulfillment
          page's Stock tab for the equivalent facility list. Restock is
          likewise unavailable server-side (adminService.isWarehouseRestockSupported()
          returns false) so no restock control is offered here. */}

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
                    Facility Code
                  </label>
                  <input
                    id="wh-modal-code"
                    type="text"
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
                    value={editingWarehouse.shipping_cost_weight ?? 1.0}
                    onChange={(e) =>
                      setEditingWarehouse({
                        ...editingWarehouse,
                        shipping_cost_weight: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
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
    </div>
  );
};
