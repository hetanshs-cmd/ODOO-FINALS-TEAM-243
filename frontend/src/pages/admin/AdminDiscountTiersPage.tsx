import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import {
  ProductCategory,
  CustomerTier,
  ApprovalChainRule,
  RiskLevel,
} from '../../types';
import {
  Percent,
  ShieldCheck,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Save,
  Check,
  Trash2,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminDiscountTiersPage: React.FC = () => {
  const {
    categoryCeilings,
    discountTiers,
    approvalRules,
    saveCategoryCeiling,
    saveDiscountTier,
    saveApprovalRule,
    quotations,
  } = useDealStore();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'ceilings' | 'tiers' | 'chains'>('ceilings');

  // Ceiling Editing State
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [ceilingInput, setCeilingInput] = useState<number>(15);

  // Tier Editing State
  const [editingTier, setEditingTier] = useState<CustomerTier | null>(null);
  const [tierInput, setTierInput] = useState<number>(15);

  // Approval Chain Modal / Edit State
  const [isChainModalOpen, setIsChainModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ApprovalChainRule> | null>(null);

  // Helper count of draft quotes
  const draftQuotesCount = quotations.filter(
    (q) => q.stage === 'Draft' || q.stage === 'Returned for Revision' || q.stage === 'ReturnedForRevision'
  ).length;

  const handleStartEditCeiling = (cat: ProductCategory, currentLimit: number) => {
    setEditingCategory(cat);
    setCeilingInput(currentLimit);
  };

  const handleSaveCeiling = (cat: ProductCategory) => {
    const parsed = Math.max(0, Math.min(100, Number(ceilingInput) || 0));
    saveCategoryCeiling(cat, parsed);
    setEditingCategory(null);
    toast.success(
      'Ceiling Updated',
      `Updated ${cat} discount ceiling to ${parsed}%. Active draft quotations recalculated live.`
    );
  };

  const handleStartEditTier = (tier: CustomerTier, currentLimit: number) => {
    setEditingTier(tier);
    setTierInput(currentLimit);
  };

  const handleSaveTier = (tier: CustomerTier) => {
    const parsed = Math.max(0, Math.min(100, Number(tierInput) || 0));
    saveDiscountTier(tier, parsed);
    setEditingTier(null);
    toast.success(
      'Customer Tier Updated',
      `Updated ${tier} Tier governance limit to ${parsed}%. Active draft quotations recalculated.`
    );
  };

  const handleCreateRule = () => {
    setEditingRule({
      id: `CHAIN-${Date.now()}`,
      name: 'Custom High Risk Escalation',
      discountRange: 'over_limit_high',
      minDiscountPercent: 25,
      maxDiscountPercent: 100,
      requiredApprovers: ['sales_manager', 'finance'],
      active: true,
      priority: approvalRules.length + 1,
      riskLevel: 'HIGH',
    });
    setIsChainModalOpen(true);
  };

  const handleEditRule = (rule: ApprovalChainRule) => {
    setEditingRule({ ...rule });
    setIsChainModalOpen(true);
  };

  const handleToggleRuleActive = (rule: ApprovalChainRule) => {
    const updated: ApprovalChainRule = { ...rule, active: !rule.active };
    saveApprovalRule(updated);
    toast.info(
      'Rule Status Changed',
      `Approval rule "${rule.name || rule.discountRange}" is now ${updated.active ? 'Active' : 'Disabled'}.`
    );
  };

  const handleSaveRuleModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.discountRange) return;

    const fullRule: ApprovalChainRule = {
      id: editingRule.id || `CHAIN-${Date.now()}`,
      name: editingRule.name || `Rule: ${editingRule.discountRange}`,
      discountRange: editingRule.discountRange,
      minDiscountPercent: Number(editingRule.minDiscountPercent) || 0,
      maxDiscountPercent: editingRule.maxDiscountPercent !== undefined ? Number(editingRule.maxDiscountPercent) : 100,
      requiredApprovers: editingRule.requiredApprovers || [],
      active: editingRule.active !== false,
      priority: Number(editingRule.priority) || 1,
      riskLevel: editingRule.riskLevel || 'MEDIUM',
    };

    saveApprovalRule(fullRule);
    toast.success(
      'Approval Chain Saved',
      `Rule "${fullRule.name}" saved. Required approvers: [${fullRule.requiredApprovers.join(', ') || 'None'}].`
    );
    setIsChainModalOpen(false);
    setEditingRule(null);
  };

  const toggleApproverInModal = (role: 'sales_manager' | 'finance') => {
    if (!editingRule) return;
    const current = editingRule.requiredApprovers || [];
    let next: ('sales_manager' | 'finance')[];
    if (current.includes(role)) {
      next = current.filter((r) => r !== role);
    } else {
      next = [...current, role];
    }
    setEditingRule({ ...editingRule, requiredApprovers: next });
  };

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
              {categoryCeilings.length} Ceilings • {discountTiers.length} Customer Tiers • {approvalRules.length} Escalation Rules
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
      <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#065F46] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#059669] shrink-0" />
          <span>
            <strong>Deterministic Governance Engine Active:</strong> Changes made here immediately govern active draft
            quotations ({draftQuotesCount} drafts in workspace). Historical confirmed quotes and completed approvals remain immutably preserved.
          </span>
        </div>
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
                {categoryCeilings.map((c) => {
                  const isEditing = editingCategory === c.category;

                  return (
                    <tr key={c.category} id={`ceiling-row-${c.category}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-[#1F2937]">
                        <span className="px-2.5 py-1 rounded bg-[#F3F4F6] border border-[#E5E7EB] text-xs font-medium">
                          {c.category}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              id={`input-ceiling-${c.category}`}
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
                            {c.maxDiscountPercent}%
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-[#6B7280]">
                        Discounts &gt; {isEditing ? ceilingInput : c.maxDiscountPercent}% will be flagged as{' '}
                        <span className="font-bold text-[#DC2626]">Over-discount</span> and trigger approval chain.
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-save-ceiling-${c.category}`}
                              onClick={() => handleSaveCeiling(c.category)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Apply</span>
                            </button>
                            <button
                              id={`btn-cancel-ceiling-${c.category}`}
                              onClick={() => setEditingCategory(null)}
                              className="px-2 py-1 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-edit-ceiling-${c.category}`}
                            onClick={() => handleStartEditCeiling(c.category, c.maxDiscountPercent)}
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
                {discountTiers.map((t) => {
                  const isEditing = editingTier === t.tier;

                  return (
                    <tr key={t.tier} id={`tier-row-${t.tier}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-[#1F2937]">
                        <span className="px-2.5 py-1 rounded font-bold text-xs bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
                          {t.tier} Tier
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center font-mono">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              id={`input-tier-${t.tier}`}
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
                            ≤ {t.maxDiscountPercent}%
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-[#6B7280]">
                        Quotes for {t.tier} accounts requiring &gt; {isEditing ? tierInput : t.maxDiscountPercent}% discount escalate to management.
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-save-tier-${t.tier}`}
                              onClick={() => handleSaveTier(t.tier)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Apply</span>
                            </button>
                            <button
                              id={`btn-cancel-tier-${t.tier}`}
                              onClick={() => setEditingTier(null)}
                              className="px-2 py-1 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-edit-tier-${t.tier}`}
                            onClick={() => handleStartEditTier(t.tier, t.maxDiscountPercent)}
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
        /* ================= APPROVAL CHAINS VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
                Multi-Step Approval Escalation Chain
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
              <span>Add Escalation Rule</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table id="approval-chains-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4 text-center">Priority</th>
                  <th className="py-2.5 px-4">Rule Name</th>
                  <th className="py-2.5 px-4">Discount Bracket</th>
                  <th className="py-2.5 px-4">Required Approvers in Chain</th>
                  <th className="py-2.5 px-4 text-center">Risk Level</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {approvalRules
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
                          <div className="font-semibold text-[#1F2937]">{rule.name || `Rule ${idx + 1}`}</div>
                          <div className="text-[11px] font-mono text-[#6B7280]">
                            Range: {rule.discountRange.replace('_', ' ')} ({rule.minDiscountPercent || 0}% - {rule.maxDiscountPercent || 100}%)
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                            {rule.discountRange}
                          </span>
                        </td>

                        <td className="py-2.5 px-4">
                          {rule.requiredApprovers.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Direct Sales Rep Authority (No Escalation)
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rule.requiredApprovers.map((approver, aIdx) => (
                                <span
                                  key={approver}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#714B67]/10 text-[#714B67] border border-[#714B67]/20"
                                >
                                  <span className="w-3.5 h-3.5 rounded-full bg-[#714B67] text-white flex items-center justify-center text-[9px] font-bold">
                                    {aIdx + 1}
                                  </span>
                                  <span>{approver === 'sales_manager' ? 'Sales Manager' : 'Finance'}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              rule.riskLevel === 'HIGH'
                                ? 'bg-[#FEE2E2] text-[#991B1B]'
                                : rule.riskLevel === 'MEDIUM'
                                ? 'bg-[#FEF3C7] text-[#92400E]'
                                : 'bg-[#ECFDF5] text-[#065F46]'
                            }`}
                          >
                            {rule.riskLevel || 'LOW'}
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
                            <span>Edit Chain</span>
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

      {/* ================= APPROVAL CHAIN MODAL ================= */}
      {isChainModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingRule.id ? 'Configure Approval Escalation Rule' : 'New Approval Rule'}
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
                  Rule Name *
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
                    Discount Bracket Range *
                  </label>
                  <select
                    id="rule-modal-range"
                    value={editingRule.discountRange || 'within_limit'}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        discountRange: e.target.value as any,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="within_limit">within_limit (Standard Rep Limit)</option>
                    <option value="over_limit_medium">over_limit_medium (Tier 1 Escalation)</option>
                    <option value="over_limit_high">over_limit_high (Tier 2 High Risk)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Risk Severity
                  </label>
                  <select
                    id="rule-modal-risk"
                    value={editingRule.riskLevel || 'MEDIUM'}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, riskLevel: e.target.value as RiskLevel })
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
                    value={editingRule.minDiscountPercent ?? 0}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, minDiscountPercent: parseFloat(e.target.value) || 0 })
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
                    value={editingRule.maxDiscountPercent ?? 100}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, maxDiscountPercent: parseFloat(e.target.value) || 100 })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Required Approver Roles
                </label>
                <div className="space-y-1.5 border border-[#E5E7EB] rounded-md p-2.5 bg-[#F9FAFB]">
                  {[
                    { role: 'sales_manager' as const, label: 'Sales Manager' },
                    { role: 'finance' as const, label: 'Finance' },
                  ].map(({ role, label }) => {
                    const isChecked = (editingRule.requiredApprovers || []).includes(role);
                    return (
                      <label
                        key={role}
                        className="flex items-center gap-2 cursor-pointer text-xs text-[#374151]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleApproverInModal(role)}
                          className="rounded border-[#D1D5DB] text-[#714B67] focus:ring-[#714B67]"
                        />
                        <span className={isChecked ? 'font-semibold text-[#714B67]' : ''}>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="text-[10px] text-[#6B7280]">
                  Unchecked = No escalation required (Direct Sales Rep authority).
                </span>
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
                  <span>Save Escalation Rule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
