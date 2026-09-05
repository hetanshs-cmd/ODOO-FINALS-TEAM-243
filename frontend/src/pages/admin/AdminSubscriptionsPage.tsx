import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import { SubscriptionPlan, BillingCycle } from '../../types';
import {
  Calendar,
  Plus,
  Edit2,
  CheckCircle2,
  Sparkles,
  Save,
  X,
  ShieldAlert,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminSubscriptionsPage: React.FC = () => {
  const {
    subscriptionPlans,
    subscriptionBillingConfig,
    saveSubscriptionPlan,
    updateSubscriptionBillingConfig,
  } = useDealStore();

  const [activeTab, setActiveTab] = useState<'plans' | 'billing_policy'>('plans');

  // Plan modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

  // Billing Policy Local State
  const [policyConfig, setPolicyConfig] = useState(subscriptionBillingConfig);

  const handleCreatePlan = () => {
    setEditingPlan({
      id: `PLAN-${Date.now()}`,
      name: '',
      cycle: 'monthly',
      price: 299,
      baseAmount: 299,
      active: true,
      prorationRule: 'daily_linear',
    });
    setIsModalOpen(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan({ ...plan });
    setIsModalOpen(true);
  };

  const handleTogglePlanActive = (plan: SubscriptionPlan) => {
    const updated: SubscriptionPlan = { ...plan, active: !plan.active };
    saveSubscriptionPlan(updated);
    toast.info(
      'Plan Status Updated',
      `Plan "${plan.name}" is now ${updated.active ? 'Active' : 'Archived'}.`
    );
  };

  const handleSavePlanModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editingPlan.name) return;

    const fullPlan: SubscriptionPlan = {
      id: editingPlan.id || `PLAN-${Date.now()}`,
      name: editingPlan.name,
      cycle: (editingPlan.cycle as 'monthly' | 'quarterly' | 'yearly') || 'monthly',
      price: Number(editingPlan.price) || 0,
      baseAmount: Number(editingPlan.price) || 0,
      active: editingPlan.active !== false,
      prorationRule: editingPlan.prorationRule || 'daily_linear',
    };

    saveSubscriptionPlan(fullPlan);
    toast.success(
      'Subscription Plan Saved',
      `Plan "${fullPlan.name}" configured at ₹${fullPlan.price}/${fullPlan.cycle}.`
    );
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  const handleSaveBillingPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    updateSubscriptionBillingConfig(policyConfig);
    toast.success(
      'Global Billing Policy Applied',
      'Proration rules and cancellation credit policies updated across all hybrid billing engines.'
    );
  };

  return (
    <div id="admin-subscriptions-container" className="space-y-4">
      {/* Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Recurring Plans & Hybrid Billing Policy
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {subscriptionPlans.length} Master Plans
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Configure recurring SaaS packages, billing intervals, daily linear proration models, and mid-cycle cancellation refund policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] text-xs font-medium">
            <button
              id="tab-sub-plans"
              onClick={() => setActiveTab('plans')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Subscription Plans
            </button>
            <button
              id="tab-billing-policy"
              onClick={() => setActiveTab('billing_policy')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'billing_policy'
                  ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Proration & Credit Policy
            </button>
          </div>

          {activeTab === 'plans' && (
            <button
              id="btn-create-sub-plan"
              onClick={handleCreatePlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Plan</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'plans' ? (
        /* ================= PLANS TABLE ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table id="subscription-plans-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4">Plan Name</th>
                  <th className="py-2.5 px-4">Cadence</th>
                  <th className="py-2.5 px-4 text-right">Recurring Unit Rate</th>
                  <th className="py-2.5 px-4">Proration Engine</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {subscriptionPlans.map((plan) => {
                  const isActive = plan.active !== false;

                  return (
                    <tr
                      key={plan.id}
                      id={`plan-row-${plan.id}`}
                      className={`hover:bg-[#F9FAFB] transition-colors ${
                        !isActive ? 'opacity-50 bg-[#FAFAFA]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#1F2937]">{plan.name}</div>
                        <div className="text-[11px] font-mono text-[#6B7280]">{plan.id}</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                          {plan.cycle}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#1F2937]">
                        ₹{plan.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-[#6B7280]">/{plan.cycle}</span>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#F3F4F6] text-[#4B5563]">
                          {plan.prorationRule || 'daily_linear'}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          id={`btn-toggle-plan-${plan.id}`}
                          onClick={() => handleTogglePlanActive(plan)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5]'
                              : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                          }`}
                        >
                          {isActive ? 'Active' : 'Archived'}
                        </button>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <button
                          id={`btn-edit-plan-${plan.id}`}
                          onClick={() => handleEditPlan(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#714B67] hover:bg-[#F5EEF4] rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= BILLING & PRORATION POLICY ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs p-4 max-w-2xl">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3 mb-4">
            <Sliders className="w-4 h-4 text-[#714B67]" />
            <div>
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide">
                Enterprise Hybrid Billing Governance
              </h3>
              <p className="text-xs text-[#6B7280]">
                Configure how DealFlow360 handles mid-cycle cancellations, prorations, and automated credit note generation.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBillingPolicy} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Proration Calculation Engine
              </label>
              <select
                id="select-proration-rule"
                value={policyConfig.prorationRule}
                onChange={(e) =>
                  setPolicyConfig({
                    ...policyConfig,
                    prorationRule: e.target.value as 'daily_linear' | 'exact_days_in_month',
                  })
                }
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                <option value="daily_linear">Daily Linear (30-day normalized formula)</option>
                <option value="exact_days_in_month">Exact Calendar Days (28-31 day basis)</option>
              </select>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Linear formula: <code>(Elapsed Days / Cycle Days) * Unit Rate</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Cancellation & Refund Credit Policy
              </label>
              <select
                id="select-cancellation-policy"
                value={policyConfig.cancellationRefundRule}
                onChange={(e) =>
                  setPolicyConfig({
                    ...policyConfig,
                    cancellationRefundRule: e.target.value as 'prorated_credit' | 'no_refund' | 'full_credit',
                  })
                }
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                <option value="prorated_credit">Prorated Credit Note (Issue Credit for Unused Days)</option>
                <option value="no_refund">No Refund (Active until period end)</option>
                <option value="full_credit">Full Period Credit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Credit Note Number Prefix
              </label>
              <input
                id="input-credit-note-prefix"
                type="text"
                value={policyConfig.creditNotePrefix}
                onChange={(e) =>
                  setPolicyConfig({
                    ...policyConfig,
                    creditNotePrefix: e.target.value,
                  })
                }
                className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>

            <div className="pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  id="checkbox-allow-midcycle"
                  type="checkbox"
                  checked={policyConfig.allowMidCycleUpgrade}
                  onChange={(e) =>
                    setPolicyConfig({
                      ...policyConfig,
                      allowMidCycleUpgrade: e.target.checked,
                    })
                  }
                  className="rounded border-[#D1D5DB] text-[#714B67] focus:ring-[#714B67]"
                />
                <span className="text-xs font-semibold text-[#374151]">
                  Allow Immediate Mid-Cycle Plan Upgrades with Delta Proration
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end">
              <button
                id="btn-save-billing-policy"
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Billing Governance</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plan Edit Modal */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingPlan.id ? 'Edit Subscription Plan' : 'New Subscription Plan'}
                </h3>
              </div>
              <button
                id="btn-close-plan-modal"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlanModal} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Plan Name *
                </label>
                <input
                  id="plan-modal-name"
                  type="text"
                  required
                  value={editingPlan.name || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="e.g. Enterprise SLA 24/7"
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Cadence / Cycle
                  </label>
                  <select
                    id="plan-modal-cycle"
                    value={editingPlan.cycle || 'monthly'}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        cycle: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Recurring Rate ($) *
                  </label>
                  <input
                    id="plan-modal-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingPlan.price ?? ''}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Proration Rule
                </label>
                <input
                  id="plan-modal-proration"
                  type="text"
                  value={editingPlan.prorationRule || 'daily_linear'}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, prorationRule: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  id="btn-cancel-plan-modal"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="btn-save-plan-modal"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
