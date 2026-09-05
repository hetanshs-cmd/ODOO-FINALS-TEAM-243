import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import { UpsellRule } from '../../types';
import {
  TrendingUp,
  Plus,
  Edit2,
  Sparkles,
  Save,
  X,
  Play,
  ArrowRight,
  Package,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminUpsellRulesPage: React.FC = () => {
  const { upsellRules, products, saveUpsellRule } = useDealStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<UpsellRule> | null>(null);

  // Simulator State
  const [simulatedProductId, setSimulatedProductId] = useState<string>(products[0]?.id || '');
  const [simulatedDealValue, setSimulatedDealValue] = useState<number>(6000);

  const handleCreateRule = () => {
    const p1 = products[0];
    const p2 = products[1] || products[0];

    setEditingRule({
      id: `UP-${Date.now()}`,
      name: `${p1?.name || 'Item'} -> ${p2?.name || 'Add-on'} Pair`,
      triggerProductId: p1?.id || '',
      recommendedProductId: p2?.id || '',
      reason: 'Frequently purchased together for higher operational reliability.',
      promoted: true,
      priority: upsellRules.length + 1,
      active: true,
      minDealValue: 0,
    });
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: UpsellRule) => {
    setEditingRule({ ...rule });
    setIsModalOpen(true);
  };

  const handleToggleRuleActive = (rule: UpsellRule) => {
    const updated: UpsellRule = { ...rule, active: !rule.active };
    saveUpsellRule(updated);
    toast.info(
      'Rule Status Updated',
      `Upsell Rule "${rule.name}" is now ${updated.active ? 'Active' : 'Disabled'}.`
    );
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.triggerProductId || !editingRule.recommendedProductId) {
      toast.warning('Validation', 'Trigger and Recommended products are required.');
      return;
    }

    const triggerP = products.find((p) => p.id === editingRule.triggerProductId);
    const recP = products.find((p) => p.id === editingRule.recommendedProductId);

    const fullRule: UpsellRule = {
      id: editingRule.id || `UP-${Date.now()}`,
      name:
        editingRule.name ||
        `${triggerP?.name || 'Trigger'} -> ${recP?.name || 'Recommendation'}`,
      triggerProductId: editingRule.triggerProductId,
      triggerProductName: triggerP?.name,
      recommendedProductId: editingRule.recommendedProductId,
      recommendedProductName: recP?.name,
      reason: editingRule.reason || 'Recommended complement.',
      promoted: Boolean(editingRule.promoted),
      priority: Number(editingRule.priority) || 1,
      active: editingRule.active !== false,
      minDealValue: Number(editingRule.minDealValue) || 0,
    };

    saveUpsellRule(fullRule);
    toast.success(
      'Upsell Rule Saved',
      `Rule "${fullRule.name}" is active. Suggestions will surface during Quotation creation.`
    );
    setIsModalOpen(false);
    setEditingRule(null);
  };

  // Run live simulator matching logic
  const matchingRules = upsellRules.filter(
    (r) =>
      r.active &&
      r.triggerProductId === simulatedProductId &&
      simulatedDealValue >= (r.minDealValue || 0)
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
              {upsellRules.length} Configured Rules
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
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {upsellRules.map((r, idx) => {
                  const triggerP = products.find((p) => p.id === r.triggerProductId);
                  const recP = products.find((p) => p.id === r.recommendedProductId);
                  const isActive = r.active !== false;

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
                          {triggerP?.name || r.triggerProductName || r.triggerProductId}
                        </div>
                        <div className="text-[11px] font-mono text-[#6B7280]">
                          {triggerP?.sku || r.triggerProductId}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#714B67] flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-[#714B67]" />
                          <span>{recP?.name || r.recommendedProductName || r.recommendedProductId}</span>
                        </div>
                        <div className="text-[11px] text-[#6B7280] line-clamp-1">{r.reason}</div>
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
                })}
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
                {products
                  .filter((p) => p.status !== 'Archived')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || p.id})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#374151] mb-1">
                Simulated Deal Value ($):
              </label>
              <input
                id="simulator-deal-value"
                type="number"
                step="500"
                value={simulatedDealValue}
                onChange={(e) => setSimulatedDealValue(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB]">
            <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider block mb-2">
              Generated Suggestions ({matchingRules.length})
            </span>

            {matchingRules.length === 0 ? (
              <div className="p-3 text-center bg-[#F9FAFB] rounded border border-dashed border-[#D1D5DB] text-xs text-[#6B7280]">
                No matching upsell rules triggered for this product and deal value.
              </div>
            ) : (
              <div className="space-y-2">
                {matchingRules.map((rule) => {
                  const recP = products.find((p) => p.id === rule.recommendedProductId);

                  return (
                    <div
                      key={rule.id}
                      className="p-2.5 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#3730A3] flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                          <span>{recP?.name || rule.recommendedProductName}</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#4338CA]">
                          ${recP?.price ?? recP?.basePrice ?? 0}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4338CA] leading-snug">{rule.reason}</p>
                    </div>
                  );
                })}
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
                  Rule Name *
                </label>
                <input
                  id="upsell-modal-name"
                  type="text"
                  required
                  value={editingRule.name || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g. Gateway -> SLA Attach"
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Trigger Product in Quotation *
                </label>
                <select
                  id="upsell-modal-trigger"
                  value={editingRule.triggerProductId || ''}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, triggerProductId: e.target.value })
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
                  value={editingRule.recommendedProductId || ''}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, recommendedProductId: e.target.value })
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
                    Min Deal Value ($)
                  </label>
                  <input
                    id="upsell-modal-min-val"
                    type="number"
                    min="0"
                    value={editingRule.minDealValue ?? 0}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        minDealValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
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
