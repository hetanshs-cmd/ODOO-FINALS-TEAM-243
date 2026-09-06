import React, { useState, useEffect, useCallback } from 'react';
import { adminService, isForbiddenError, productService } from '../../services';
import { ApiRecommendationRule, ApiProduct } from '../../services/apiTypes';
import { ApiError } from '../../services/httpClient';
import {
  TrendingUp,
  Plus,
  Edit2,
  Sparkles,
  Save,
  X,
  Play,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

// Migrated off the mock store's upsellRules onto the real
// /admin/recommendation-rules CRUD — fields match 1:1 per the backend
// research already done for this migration (source_product_id,
// recommended_product_id, recommendation_type, priority, reason, status).
// The mock's `promoted` flag and `minDealValue` threshold have no backend
// column and are dropped from the form/simulator rather than fabricated.
export const AdminUpsellRulesPage: React.FC = () => {
  const [rules, setRules] = useState<ApiRecommendationRule[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ApiRecommendationRule> | null>(null);

  // Simulator state — matches by source product only (no minDealValue on
  // the real schema to filter by).
  const [simulatedProductId, setSimulatedProductId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const [ruleData, productData] = await Promise.all([
        adminService.recommendationRules.list(),
        productService.getAll() as Promise<ApiProduct[]>,
      ]);
      setRules(ruleData);
      setProducts(productData);
      if (!simulatedProductId && productData.length > 0) {
        setSimulatedProductId(productData[0].id);
      }
    } catch (err) {
      if (isForbiddenError(err)) {
        setForbidden(true);
      } else {
        toast.warning('Load Failed', err instanceof ApiError ? err.message : 'Could not load upsell rules.');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || id;
  const getProductSku = (id: string) => products.find((p) => p.id === id)?.sku || id;

  const handleCreateRule = () => {
    const p1 = products[0];
    const p2 = products[1] || products[0];

    setEditingRule({
      source_product_id: p1?.id || '',
      recommended_product_id: p2?.id || '',
      recommendation_type: 'UPSELL',
      reason: 'Frequently purchased together for higher operational reliability.',
      priority: rules.length + 1,
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: ApiRecommendationRule) => {
    setEditingRule({ ...rule });
    setIsModalOpen(true);
  };

  const handleToggleRuleActive = async (rule: ApiRecommendationRule) => {
    const nextStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.recommendationRules.update(rule.id, { status: nextStatus } as Partial<ApiRecommendationRule>);
      await load();
      toast.info('Rule Status Updated', `Recommendation rule is now ${nextStatus === 'ACTIVE' ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      toast.warning('Update Failed', err instanceof ApiError ? err.message : 'Could not update rule.');
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.source_product_id || !editingRule.recommended_product_id) {
      toast.warning('Validation', 'Trigger and Recommended products are required.');
      return;
    }

    const payload: Partial<ApiRecommendationRule> = {
      source_product_id: editingRule.source_product_id,
      recommended_product_id: editingRule.recommended_product_id,
      recommendation_type: editingRule.recommendation_type || 'UPSELL',
      reason: editingRule.reason || 'Recommended complement.',
      priority: Number(editingRule.priority) || 1,
      status: editingRule.status || 'ACTIVE',
    };

    try {
      if (editingRule.id) {
        await adminService.recommendationRules.update(editingRule.id, payload);
      } else {
        await adminService.recommendationRules.create(payload);
      }
      await load();
      toast.success('Upsell Rule Saved', 'Suggestions will surface during Quotation creation.');
      setIsModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      toast.warning('Save Failed', err instanceof ApiError ? err.message : 'Could not save rule.');
    }
  };

  if (forbidden) {
    return (
      <div className="p-6 bg-white rounded-lg border border-[#E5E7EB] text-xs text-[#6B7280]">
        You don't have access to upsell rule administration.
      </div>
    );
  }

  // Run live simulator matching logic (source product + active status only)
  const matchingRules = rules.filter(
    (r) => r.status === 'ACTIVE' && r.source_product_id === simulatedProductId
  );

  return (
    <div id="admin-upsell-rules-container" className="space-y-4">
      {/* Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Upsell & Cross-Sell Matrix Engine
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {rules.length} Configured Rules
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Configure automated cross-sell prompts, accessory attachments, and value-based add-on recommendations that display in the Quotation Builder.
          </p>
        </div>

        <button
          id="btn-create-upsell-rule"
          onClick={handleCreateRule}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Recommendation Rule</span>
        </button>
      </div>

      {/* Grid: Rules Table (2/3) + Interactive Simulator (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rules Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
              Recommendation Rules Matrix
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table id="upsell-rules-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4 text-center">Priority</th>
                  <th className="py-2.5 px-4">Trigger Product</th>
                  <th className="py-2.5 px-4">Recommended Add-On</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF] italic">
                      Loading rules…
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF] italic">
                      No recommendation rules configured yet.
                    </td>
                  </tr>
                ) : (
                  rules.map((r, idx) => {
                    const isActive = r.status === 'ACTIVE';

                    return (
                      <tr
                        key={r.id}
                        id={`upsell-row-${r.id}`}
                        className={`hover:bg-[#F9FAFB] transition-colors ${
                          !isActive ? 'opacity-50 bg-[#FAFAFA]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-[#6B7280]">
                          #{r.priority || idx + 1}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#1F2937]">
                            {getProductName(r.source_product_id)}
                          </div>
                          <div className="text-[11px] font-mono text-[#6B7280]">
                            {getProductSku(r.source_product_id)}
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#714B67] flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-[#714B67]" />
                            <span>{getProductName(r.recommended_product_id)}</span>
                          </div>
                          <div className="text-[11px] text-[#6B7280] line-clamp-1">{r.reason}</div>
                        </td>

                        <td className="py-2.5 px-4 text-[#4B5563] font-medium">
                          {r.recommendation_type}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <button
                            id={`btn-toggle-upsell-${r.id}`}
                            onClick={() => handleToggleRuleActive(r)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                              isActive
                                ? 'bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5]'
                                : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                            }`}
                          >
                            {isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-edit-upsell-${r.id}`}
                              onClick={() => handleEditRule(r)}
                              className="p-1 text-[#6B7280] hover:text-[#714B67] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Recommendation Simulator */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs p-4 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
            <Play className="w-4 h-4 text-[#714B67]" />
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
                Recommendation Simulator
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Test what suggestions a sales rep sees when adding items to a quote.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#374151] mb-1">
                Select Item Added to Cart:
              </label>
              <select
                id="simulator-product-select"
                value={simulatedProductId}
                onChange={(e) => setSimulatedProductId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || p.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB]">
            <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider block mb-2">
              Generated Suggestions ({matchingRules.length})
            </span>

            {matchingRules.length === 0 ? (
              <div className="p-3 text-center bg-[#F9FAFB] rounded border border-dashed border-[#D1D5DB] text-xs text-[#6B7280]">
                No matching upsell rules triggered for this product.
              </div>
            ) : (
              <div className="space-y-2">
                {matchingRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-2.5 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#3730A3] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                        <span>{getProductName(rule.recommended_product_id)}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4338CA] leading-snug">{rule.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Upsell Modal */}
      {isModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingRule.id ? 'Edit Upsell Rule' : 'New Upsell Rule'}
                </h3>
              </div>
              <button
                id="btn-close-upsell-modal"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Trigger Product in Quotation *
                </label>
                <select
                  id="upsell-modal-trigger"
                  value={editingRule.source_product_id || ''}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, source_product_id: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Recommended Add-on Product *
                </label>
                <select
                  id="upsell-modal-rec"
                  value={editingRule.recommended_product_id || ''}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, recommended_product_id: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Recommendation Type
                  </label>
                  <select
                    id="upsell-modal-type"
                    value={editingRule.recommendation_type || 'UPSELL'}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, recommendation_type: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="UPSELL">UPSELL</option>
                    <option value="CROSS_SELL">CROSS_SELL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Priority Rank
                  </label>
                  <input
                    id="upsell-modal-priority"
                    type="number"
                    min="1"
                    value={editingRule.priority ?? 1}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        priority: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Recommendation Reason / Rep Pitch *
                </label>
                <textarea
                  id="upsell-modal-pitch"
                  rows={2}
                  required
                  value={editingRule.reason || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, reason: e.target.value })}
                  placeholder="Explain why the customer benefits from this add-on..."
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  id="btn-cancel-upsell-modal"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="btn-save-upsell-modal"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Rule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
