import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Package,
  Percent,
  Truck,
  Repeat,
  Sparkles,
  Settings,
  ArrowLeft,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

export const BackendLayout: React.FC = () => {
  const navigate = useNavigate();

  const configTabs = [
    {
      label: 'Products & Price Lists',
      path: '/admin/products',
      icon: <Package className="w-4 h-4" />,
    },
    {
      label: 'Discount Tiers & Approval Chains',
      path: '/admin/discount-tiers',
      icon: <Percent className="w-4 h-4" />,
    },
    {
      label: 'Warehouses & Fulfillment',
      path: '/admin/warehouses',
      icon: <Truck className="w-4 h-4" />,
    },
    {
      label: 'Subscription Plans',
      path: '/admin/subscriptions',
      icon: <Repeat className="w-4 h-4" />,
    },
    {
      label: 'Upsell / Cross-Sell Rules',
      path: '/admin/upsell-rules',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      label: 'Reporting Configuration',
      path: '/admin/reporting',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B5563] hover:text-[#714B67] mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Operational Workspace
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#714B67] text-white rounded-md shadow-2xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1F2937] tracking-tight">Administration & Governance Workbench</h1>
              <p className="text-xs text-[#6B7280]">
                Configure master catalogs, category ceilings, approval escalation chains, and fulfillment parameters.
              </p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#ECFDF5] border border-[#A7F3D0] rounded-md text-xs text-[#065F46] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
          <span>Real-time Shared State Active</span>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-[#E5E7EB] gap-1 overflow-x-auto pb-px">
        {configTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex items-center gap-2 py-2 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                isActive
                  ? 'border-[#714B67] text-[#714B67] font-semibold bg-white rounded-t-md'
                  : 'border-transparent text-[#6B7280] hover:text-[#1F2937] hover:border-[#D1D5DB]'
              }`
            }
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Admin Section Outlet */}
      <div className="bg-white rounded-md border border-[#E5E7EB] p-4.5 shadow-2xs">
        <Outlet />
      </div>
    </div>
  );
};
