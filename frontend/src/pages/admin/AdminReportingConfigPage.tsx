import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import { ReportingConfiguration, ConfigAuditEvent } from '../../types';
import {
  FileText,
  Save,
  CheckCircle2,
  Clock,
  User,
  History,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminReportingConfigPage: React.FC = () => {
  const {
    reportingConfig,
    configAuditTrail,
    saveReportingConfig,
  } = useDealStore();

  const [activeTab, setActiveTab] = useState<'kpi_config' | 'audit_log'>('kpi_config');

  // Form state
  const [formData, setFormData] = useState<ReportingConfiguration>(reportingConfig);
  const [auditFilterCategory, setAuditFilterCategory] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');

  const kpiOptions = [
    { id: 'quotes_created', label: 'Quotation Volume & Pipeline Velocity' },
    { id: 'pipeline_value', label: 'Gross Pipeline Dollar Value' },
    { id: 'avg_approval_time', label: 'Management Approval Turnaround' },
    { id: 'top_upsell', label: 'Cross-Sell Attach Rate & Lift' },
    { id: 'blended_margin', label: 'Blended Contract Gross Margin' },
    { id: 'win_rate', label: 'Sales Rep Win Rate & Conversion' },
  ];

  const toggleKpi = (id: string) => {
    const current = formData.visibleKpis || [];
    let updated: string[];
    if (current.includes(id)) {
      updated = current.filter((k) => k !== id);
    } else {
      updated = [...current, id];
    }
    setFormData({ ...formData, visibleKpis: updated });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveReportingConfig(formData);
    toast.success(
      'Reporting Configuration Saved',
      'Executive dashboard and PDF export templates updated.'
    );
  };

  const filteredAuditEvents = configAuditTrail.filter((event) => {
    const matchesCategory =
      auditFilterCategory === 'ALL' || event.category === auditFilterCategory;
    const matchesSearch =
      event.recordName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (event.details && event.details.toLowerCase().includes(auditSearch.toLowerCase())) ||
      event.actorName.toLowerCase().includes(auditSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="admin-reporting-config-container" className="space-y-4">
      {/* Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Reporting Benchmarks & Governance Audit Trail
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {configAuditTrail.length} Immutable Audit Log Entries
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Customize executive KPIs, corporate PDF letterhead headers, and inspect the chronological administrative change audit trail.
          </p>
        </div>

        <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] text-xs font-medium">
          <button
            id="tab-kpi-settings"
            onClick={() => setActiveTab('kpi_config')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'kpi_config'
                ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            KPI & Header Setup
          </button>
          <button
            id="tab-config-audit"
            onClick={() => setActiveTab('audit_log')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'audit_log'
                ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Configuration Audit Log ({configAuditTrail.length})
          </button>
        </div>
      </div>

      {activeTab === 'kpi_config' ? (
        /* ================= KPI & PDF REPORT HEADER CONFIG ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs p-4 max-w-2xl">
          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="border-b border-[#E5E7EB] pb-3">
              <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wide mb-1">
                Executive Reporting Header & Branding
              </h3>
              <p className="text-xs text-[#6B7280]">
                Appears on printed audit reports, stakeholder summaries, and executive PDF exports.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Company Header Text *
              </label>
              <input
                id="input-company-header"
                type="text"
                required
                value={formData.companyHeader}
                onChange={(e) => setFormData({ ...formData, companyHeader: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Corporate Governance Tagline
              </label>
              <input
                id="input-company-tagline"
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Default Historical Reporting Period
              </label>
              <select
                id="select-reporting-period"
                value={formData.defaultPeriod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultPeriod: e.target.value as any,
                  })
                }
                className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                <option value="Last30Days">Last 30 Days</option>
                <option value="LastQuarter">Last Quarter</option>
                <option value="YearToDate">Year to Date (YTD)</option>
                <option value="AllTime">All Time (Full Ledger History)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#E5E7EB]">
              <label className="block text-xs font-semibold text-[#374151] mb-2">
                Visible Executive KPI Metric Cards
              </label>
              <div className="space-y-2 bg-[#F9FAFB] p-3 rounded-md border border-[#E5E7EB]">
                {kpiOptions.map((opt) => {
                  const isChecked = (formData.visibleKpis || []).includes(opt.id);
                  return (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleKpi(opt.id)}
                        className="rounded border-[#D1D5DB] text-[#714B67] focus:ring-[#714B67]"
                      />
                      <span className={`text-xs ${isChecked ? 'font-semibold text-[#1F2937]' : 'text-[#6B7280]'}`}>
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  id="checkbox-auditor-notes"
                  type="checkbox"
                  checked={formData.includeAuditorNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, includeAuditorNotes: e.target.checked })
                  }
                  className="rounded border-[#D1D5DB] text-[#714B67] focus:ring-[#714B67]"
                />
                <span className="text-xs font-semibold text-[#374151]">
                  Include SOX & Compliance Auditor Footnotes on Master Reports
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end">
              <button
                id="btn-save-reporting-config"
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Report Preferences</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ================= IMMUTABLE AUDIT TRAIL VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                id="search-audit-input"
                type="text"
                placeholder="Search audit trail by record or actor..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-md text-[#1F2937] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#6B7280] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" /> Area:
              </span>
              <select
                id="select-audit-category"
                value={auditFilterCategory}
                onChange={(e) => setAuditFilterCategory(e.target.value)}
                className="bg-white border border-[#D1D5DB] rounded-md px-2.5 py-1.5 text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                <option value="ALL">All Categories</option>
                <option value="products">Products</option>
                <option value="price_lists">Price Lists</option>
                <option value="discount_tiers">Discount Tiers</option>
                <option value="approval_chains">Approval Chains</option>
                <option value="warehouses">Warehouses</option>
                <option value="subscription_plans">Subscription Plans</option>
                <option value="upsell_rules">Upsell Rules</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table id="audit-trail-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Area</th>
                  <th className="py-2.5 px-4">Record Name</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                  <th className="py-2.5 px-4">Change Summary</th>
                  <th className="py-2.5 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredAuditEvents.map((evt) => (
                  <tr key={evt.id} id={`audit-row-${evt.id}`} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-2.5 px-4 text-[11px] font-mono text-[#6B7280] whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#9CA3AF]" />
                        <span>{new Date(evt.timestamp).toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                        {evt.category}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 font-semibold text-[#1F2937]">
                      {evt.recordName}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          evt.action === 'create'
                            ? 'bg-[#ECFDF5] text-[#065F46]'
                            : evt.action === 'archive' || evt.action === 'deactivate'
                            ? 'bg-[#FEE2E2] text-[#991B1B]'
                            : 'bg-[#EFF6FF] text-[#1E40AF]'
                        }`}
                      >
                        {evt.action}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-xs text-[#374151]">
                      {evt.oldValue && evt.newValue ? (
                        <div className="font-mono text-[11px]">
                          <span className="text-[#DC2626] line-through mr-1">{evt.oldValue}</span>
                          <span>→</span>
                          <span className="text-[#059669] font-bold ml-1">{evt.newValue}</span>
                        </div>
                      ) : null}
                      {evt.details && <div className="text-[11px] text-[#6B7280] mt-0.5">{evt.details}</div>}
                    </td>

                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-[#1F2937]">
                        <User className="w-3 h-3 text-[#9CA3AF]" />
                        <span className="font-medium">{evt.actorName}</span>
                        <span className="text-[10px] text-[#6B7280]">({evt.actorRole})</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
