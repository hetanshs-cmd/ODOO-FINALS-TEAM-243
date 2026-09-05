import React, { useState, useEffect, useCallback } from 'react';
import { adminService, isForbiddenError } from '../../services';
import { ApiDiscountRule, ApiApprovalLevel } from '../../services/apiTypes';
import { ApiError } from '../../services/httpClient';
import { ProductCategory, CustomerTier, RiskLevel } from '../../types';
import {
  Percent,
  ShieldCheck,
  Plus,
  Edit2,
  Sparkles,
  Save,
  Check,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

// Migrated off the mock store's three conflated concepts (categoryCeilings,
// discountTiers, approvalRules) onto the two real backend resources per the
// migration brief: /admin/discount-rules (scoped by nullable
// product/category/customer_tier columns, strictest-wins precedence per
// docs/references.md's Medusa pricing note) covers both the Category
// Ceilings and Customer Tiers tabs; /admin/approval-levels covers the
// Approval Escalation Matrix tab. The 3-tab layout is preserved even though
// two tabs now read from the same underlying resource, filtered client-side
// by which scope column is populated.
const CATEGORIES: ProductCategory[] = ['Hardware', 'Services', 'Subscription'];
const TIERS: CustomerTier[] = ['Bronze', 'Silver', 'Gold'];

function getMaxDiscount(rule: ApiDiscountRule | undefined): number {
  if (!rule) return 0;
  const v = typeof rule.max_discount_percent === 'string' ? parseFloat(rule.max_discount_percent) : rule.max_discount_percent;
  return Number.isFinite(v) ? v : 0;
}

export const AdminDiscountTiersPage: React.FC = () => {
  const [discountRules, setDiscountRules] = useState<ApiDiscountRule[]>([]);
  const [approvalLevels, setApprovalLevels] = useState<ApiApprovalLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'ceilings' | 'tiers' | 'chains'>('ceilings');

  // Ceiling Editing State
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [ceilingInput, setCeilingInput] = useState<number>(15);

  // Tier Editing State
  const [editingTier, setEditingTier] = useState<CustomerTier | null>(null);
  const [tierInput, setTierInput] = useState<number>(15);

  // Approval Level Modal / Edit State
  const [isChainModalOpen, setIsChainModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ApiApprovalLevel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const [rules, levels] = await Promise.all([
        adminService.discountRules.list(),
        adminService.approvalLevels.list(),
      ]);
      setDiscountRules(rules);
      setApprovalLevels(levels);
    } catch (err) {
      if (isForbiddenError(err)) {
        setForbidden(true);
      } else {
        toast.warning('Load Failed', err instanceof ApiError ? err.message : 'Could not load governance config.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categoryRules = new Map<string, ApiDiscountRule>(
    discountRules
      .filter((r) => r.category && !r.customer_tier)
      .map((r): [string, ApiDiscountRule] => [r.category as string, r])
  );
  const tierRules = new Map<string, ApiDiscountRule>(
    discountRules
      .filter((r) => r.customer_tier && !r.category)
      .map((r): [string, ApiDiscountRule] => [r.customer_tier as string, r])
  );

  const handleStartEditCeiling = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCeilingInput(getMaxDiscount(categoryRules.get(cat)) || 15);
  };

  const handleSaveCeiling = async (cat: ProductCategory) => {
    const parsed = Math.max(0, Math.min(100, Number(ceilingInput) || 0));
    const existing = categoryRules.get(cat);
    try {
      if (existing) {
        await adminService.discountRules.update(existing.id, { max_discount_percent: parsed });
      } else {
        await adminService.discountRules.create({ category: cat, max_discount_percent: parsed, active: true });
      }
      await load();
      setEditingCategory(null);
      toast.success('Ceiling Updated', `Updated ${cat} discount ceiling to ${parsed}%.`);
    } catch (err) {
      toast.warning('Save Failed', err instanceof ApiError ? err.message : 'Could not save ceiling.');
    }
  };

  const handleStartEditTier = (tier: CustomerTier) => {
    setEditingTier(tier);
    setTierInput(getMaxDiscount(tierRules.get(tier)) || 15);
  };

  const handleSaveTier = async (tier: CustomerTier) => {
    const parsed = Math.max(0, Math.min(100, Number(tierInput) || 0));
    const existing = tierRules.get(tier);
    try {
      if (existing) {
        await adminService.discountRules.update(existing.id, { max_discount_percent: parsed });
      } else {
        await adminService.discountRules.create({ customer_tier: tier, max_discount_percent: parsed, active: true });
      }
      await load();
      setEditingTier(null);
      toast.success('Customer Tier Updated', `Updated ${tier} Tier governance limit to ${parsed}%.`);
    } catch (err) {
      toast.warning('Save Failed', err instanceof ApiError ? err.message : 'Could not save tier limit.');
    }
  };

  const handleCreateRule = () => {
    setEditingRule({
      name: 'Custom High Risk Escalation',
      min_discount_percent: 25,
      max_discount_percent: 100,
      required_role: 'sales_manager',
      risk_level: 'HIGH',
      priority: approvalLevels.length + 1,
      active: true,
    });
    setIsChainModalOpen(true);
  };

  const handleEditRule = (rule: ApiApprovalLevel) => {
    setEditingRule({ ...rule });
    setIsChainModalOpen(true);
  };

  const handleToggleRuleActive = async (rule: ApiApprovalLevel) => {
    const nextActive = !(rule.active !== false);
    try {
      await adminService.approvalLevels.update(rule.id, { active: nextActive } as Partial<ApiApprovalLevel>);
      await load();
      toast.info('Rule Status Changed', `Approval level "${rule.name || rule.id}" is now ${nextActive ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      toast.warning('Update Failed', err instanceof ApiError ? err.message : 'Could not update rule.');
    }
  };

  const handleSaveRuleModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const payload: Partial<ApiApprovalLevel> = {
      name: editingRule.name || `Level ${(editingRule.priority ?? approvalLevels.length + 1)}`,
      min_discount_percent: Number(editingRule.min_discount_percent) || 0,
      max_discount_percent: editingRule.max_discount_percent !== undefined ? Number(editingRule.max_discount_percent) : 100,
      required_role: editingRule.required_role || 'sales_manager',
      risk_level: editingRule.risk_level || 'MEDIUM',
      priority: Number(editingRule.priority) || 1,
      active: editingRule.active !== false,
    };

    try {
      if (editingRule.id) {
        await adminService.approvalLevels.update(editingRule.id, payload);
      } else {
        await adminService.approvalLevels.create(payload);
      }
      await load();
      toast.success('Approval Level Saved', `Level "${payload.name}" saved.`);
      setIsChainModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      toast.warning('Save Failed', err instanceof ApiError ? err.message : 'Could not save approval level.');
    }
  };

  if (forbidden) {
    return (
      <div className="p-6 bg-white rounded-lg border border-[#E5E7EB] text-xs text-[#6B7280]">
        You don't have access to discount governance administration.
      </div>
    );
  }

  return (
    <div id="admin-discount-governance" className="space-y-4">
      {/* Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Discount Governance & Approval Escalation
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {categoryRules.size} Ceilings • {tierRules.size} Customer Tiers • {approvalLevels.length} Escalation Levels
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Manage product category discount ceilings, customer account tiers, and automated multi-step management approval chains.
          </p>
        </div>

        {/* View Switcher */}
        <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] text-xs font-medium">
          <button
            id="tab-category-ceilings"
            onClick={() => setActiveTab('ceilings')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'ceilings'
                ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Category Ceilings
          </button>
          <button
            id="tab-customer-tiers"
            onClick={() => setActiveTab('tiers')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'tiers'
                ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Customer Tiers
          </button>
          <button
            id="tab-approval-chains"
            onClick={() => setActiveTab('chains')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'chains'
                ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Approval Escalation Matrix
          </button>
        </div>
      </div>

      {/* Live Sync Banner */}
      <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#065F46] flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#059669] shrink-0" />
        <span>
          <strong>Real Governance Engine:</strong> Category Ceilings and Customer Tiers below are both backed by the
          same discount-rules resource, distinguished by which scope column (category vs. customer tier) is set —
          the stricter of the two applies to any given line. Escalation levels are enforced server-side on submit.
        </span>
      </div>

      {activeTab === 'ceilings' && (
        /* ================= CATEGORY CEILINGS VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
              Product Category Max Discount Ceilings
            </h3>
            <p className="text-xs text-[#6B7280]">
              Discounts granted exceeding these category limits automatically flag line items as "Over-Limit" and escalate to management.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table id="category-ceilings-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4">Product Category</th>
                  <th className="py-2.5 px-4 text-center">Max Allowed Discount</th>
                  <th className="py-2.5 px-4">Escalation Trigger Threshold</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {CATEGORIES.map((cat) => {
                  const rule = categoryRules.get(cat);
                  const currentLimit = getMaxDiscount(rule);
                  const isEditing = editingCategory === cat;

                  return (
                    <tr key={cat} id={`ceiling-row-${cat}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-[#1F2937]">
                        <span className="px-2.5 py-1 rounded bg-[#F3F4F6] border border-[#E5E7EB] text-xs font-medium">
                          {cat}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              id={`input-ceiling-${cat}`}
                              type="number"
                              min="0"
                              max="100"
                              value={ceilingInput}
                              onChange={(e) => setCeilingInput(parseFloat(e.target.value) || 0)}
                              className="w-20 text-center px-2 py-1 text-xs font-mono font-bold bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded focus:outline-hidden"
                            />
                            <span className="font-bold">%</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                            {rule ? `${currentLimit}%` : 'Not set'}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-[#6B7280]">
                        Discounts &gt; {isEditing ? ceilingInput : currentLimit}% will be flagged as{' '}
                        <span className="font-bold text-[#DC2626]">Over-discount</span> and trigger approval chain.
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-save-ceiling-${cat}`}
                              onClick={() => handleSaveCeiling(cat)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Apply</span>
                            </button>
                            <button
                              id={`btn-cancel-ceiling-${cat}`}
                              onClick={() => setEditingCategory(null)}
                              className="px-2 py-1 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-edit-ceiling-${cat}`}
                            onClick={() => handleStartEditCeiling(cat)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#714B67] hover:bg-[#F5EEF4] rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Limit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tiers' && (
        /* ================= CUSTOMER TIERS VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
              Customer Tier Governance Limits
            </h3>
            <p className="text-xs text-[#6B7280]">
              Baseline customer discount limits by tier (Bronze, Silver, Gold).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table id="customer-tiers-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4">Customer Tier</th>
                  <th className="py-2.5 px-4 text-center">Standard Permitted Limit</th>
                  <th className="py-2.5 px-4">Governance Rule</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {TIERS.map((tier) => {
                  const rule = tierRules.get(tier);
                  const currentLimit = getMaxDiscount(rule);
                  const isEditing = editingTier === tier;

                  return (
                    <tr key={tier} id={`tier-row-${tier}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-[#1F2937]">
                        <span className="px-2.5 py-1 rounded font-bold text-xs bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
                          {tier} Tier
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              id={`input-tier-${tier}`}
                              type="number"
                              min="0"
                              max="100"
                              value={tierInput}
                              onChange={(e) => setTierInput(parseFloat(e.target.value) || 0)}
                              className="w-20 text-center px-2 py-1 text-xs font-mono font-bold bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] rounded focus:outline-hidden"
                            />
                            <span className="font-bold">%</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                            {rule ? `≤ ${currentLimit}%` : 'Not set'}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-[#6B7280]">
                        Quotes for {tier} accounts requiring &gt; {isEditing ? tierInput : currentLimit}% discount escalate to management.
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-save-tier-${tier}`}
                              onClick={() => handleSaveTier(tier)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Apply</span>
                            </button>
                            <button
                              id={`btn-cancel-tier-${tier}`}
                              onClick={() => setEditingTier(null)}
                              className="px-2 py-1 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-edit-tier-${tier}`}
                            onClick={() => handleStartEditTier(tier)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#714B67] hover:bg-[#F5EEF4] rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Tier Limit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'chains' && (
        /* ================= APPROVAL ESCALATION MATRIX VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
                Multi-Step Approval Escalation Levels
              </h3>
              <p className="text-xs text-[#6B7280]">
                Defines required authority levels depending on total deal discount brackets and margin risk levels.
              </p>
            </div>

            <button
              id="btn-add-approval-rule"
              onClick={handleCreateRule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Escalation Level</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table id="approval-chains-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4 text-center">Priority</th>
                  <th className="py-2.5 px-4">Level Name</th>
                  <th className="py-2.5 px-4">Discount Bracket</th>
                  <th className="py-2.5 px-4">Required Role</th>
                  <th className="py-2.5 px-4 text-center">Risk Level</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF] italic">
                      Loading escalation levels…
                    </td>
                  </tr>
                ) : approvalLevels.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#9CA3AF] italic">
                      No escalation levels configured yet.
                    </td>
                  </tr>
                ) : (
                  [...approvalLevels]
                    .sort((a, b) => (a.priority || 1) - (b.priority || 1))
                    .map((rule, idx) => {
                      const isActive = rule.active !== false;

                      return (
                        <tr
                          key={rule.id || idx}
                          id={`rule-row-${rule.id || idx}`}
                          className={`hover:bg-[#F9FAFB] transition-colors ${
                            !isActive ? 'opacity-50 bg-[#FAFAFA]' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-[#6B7280]">
                            #{rule.priority || idx + 1}
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-[#1F2937]">{rule.name || `Level ${idx + 1}`}</div>
                            <div className="text-[11px] font-mono text-[#6B7280]">
                              {rule.min_discount_percent ?? 0}% – {rule.max_discount_percent ?? 100}%
                            </div>
                          </td>

                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                              {rule.min_discount_percent ?? 0}%–{rule.max_discount_percent ?? 100}%
                            </span>
                          </td>

                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#714B67]/10 text-[#714B67] border border-[#714B67]/20">
                              {rule.required_role || rule.required_roles?.join(', ') || 'sales_manager'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                rule.risk_level === 'HIGH'
                                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                                  : rule.risk_level === 'MEDIUM'
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#ECFDF5] text-[#065F46]'
                              }`}
                            >
                              {rule.risk_level || 'LOW'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <button
                              id={`btn-toggle-rule-${rule.id || idx}`}
                              onClick={() => handleToggleRuleActive(rule)}
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
                            <button
                              id={`btn-edit-rule-${rule.id || idx}`}
                              onClick={() => handleEditRule(rule)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#714B67] hover:bg-[#F5EEF4] rounded transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Level</span>
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
      )}

      {/* ================= APPROVAL LEVEL MODAL ================= */}
      {isChainModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingRule.id ? 'Configure Approval Escalation Level' : 'New Approval Level'}
                </h3>
              </div>
              <button
                id="btn-close-chain-modal"
                onClick={() => setIsChainModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRuleModal} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Level Name *
                </label>
                <input
                  id="rule-modal-name"
                  type="text"
                  required
                  value={editingRule.name || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="e.g. Medium Discount Escalation"
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Required Role *
                  </label>
                  <select
                    id="rule-modal-role"
                    value={editingRule.required_role || 'sales_manager'}
                    onChange={(e) => setEditingRule({ ...editingRule, required_role: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="sales_manager">Sales Manager</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Risk Severity
                  </label>
                  <select
                    id="rule-modal-risk"
                    value={editingRule.risk_level || 'MEDIUM'}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, risk_level: e.target.value as RiskLevel })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Min Discount (%)
                  </label>
                  <input
                    id="rule-modal-min"
                    type="number"
                    min="0"
                    max="100"
                    value={editingRule.min_discount_percent ?? 0}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, min_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Max Discount (%)
                  </label>
                  <input
                    id="rule-modal-max"
                    type="number"
                    min="0"
                    max="100"
                    value={editingRule.max_discount_percent ?? 100}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, max_discount_percent: parseFloat(e.target.value) || 100 })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Priority
                </label>
                <input
                  id="rule-modal-priority"
                  type="number"
                  min="1"
                  value={editingRule.priority ?? 1}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 1 })}
                  className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  id="btn-cancel-rule-modal"
                  type="button"
                  onClick={() => setIsChainModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="btn-save-rule-modal"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Escalation Level</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
