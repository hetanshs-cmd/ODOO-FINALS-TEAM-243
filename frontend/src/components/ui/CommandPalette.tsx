import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Package,
  Repeat,
  Receipt,
  Activity,
  BarChart3,
  Boxes,
  Sparkles,
  Sliders,
  RotateCw,
  RefreshCw,
  X,
  Plus,
} from 'lucide-react';
export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  onReset: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onReload,
  onReset,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    // Navigation
    {
      id: 'nav_dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      icon: <LayoutDashboard className="w-4 h-4 text-[#714B67]" />,
      action: () => {
        navigate('/dashboard');
        onClose();
      },
    },
    {
      id: 'nav_new_quote',
      label: 'New Quotation Builder',
      category: 'Actions',
      icon: <Plus className="w-4 h-4 text-emerald-600" />,
      action: () => {
        navigate('/quotations/new');
        onClose();
      },
    },
    {
      id: 'nav_quotations',
      label: 'Open Quotations List',
      category: 'Navigation',
      icon: <FileText className="w-4 h-4 text-[#714B67]" />,
      action: () => {
        navigate('/quotations');
        onClose();
      },
    },
    {
      id: 'nav_approvals',
      label: 'Open Approvals Queue',
      category: 'Navigation',
      icon: <CheckSquare className="w-4 h-4 text-amber-600" />,
      action: () => {
        navigate('/approvals');
        onClose();
      },
    },
    {
      id: 'nav_fulfillment',
      label: 'Open Fulfillment & Split Allocation',
      category: 'Navigation',
      icon: <Package className="w-4 h-4 text-blue-600" />,
      action: () => {
        navigate('/fulfillment');
        onClose();
      },
    },
    {
      id: 'nav_subscriptions',
      label: 'Open Subscriptions & Hybrid Billing',
      category: 'Navigation',
      icon: <Repeat className="w-4 h-4 text-purple-600" />,
      action: () => {
        navigate('/subscriptions');
        onClose();
      },
    },
    {
      id: 'nav_invoices',
      label: 'Open Invoices & Payment Settlement',
      category: 'Navigation',
      icon: <Receipt className="w-4 h-4 text-emerald-600" />,
      action: () => {
        navigate('/invoices');
        onClose();
      },
    },
    {
      id: 'nav_deal_health',
      label: 'Open Deal Health Anomaly Triage',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-rose-600" />,
      action: () => {
        navigate('/deal-health');
        onClose();
      },
    },
    {
      id: 'nav_reports',
      label: 'Open Reports & Analytics',
      category: 'Navigation',
      icon: <BarChart3 className="w-4 h-4 text-cyan-600" />,
      action: () => {
        navigate('/reports');
        onClose();
      },
    },
    {
      id: 'nav_products',
      label: 'Open Products Catalog',
      category: 'Navigation',
      icon: <Boxes className="w-4 h-4 text-slate-600" />,
      action: () => {
        navigate('/products');
        onClose();
      },
    },
    {
      id: 'nav_ai_command',
      label: 'Ask DealFlow360 AI / Command Center',
      category: 'Actions',
      icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
      action: () => {
        navigate('/command-center');
        onClose();
      },
    },
    {
      id: 'nav_admin',
      label: 'Go to Back-end Configuration',
      category: 'Navigation',
      icon: <Sliders className="w-4 h-4 text-[#714B67]" />,
      action: () => {
        navigate('/admin/products');
        onClose();
      },
    },
    {
      id: 'action_reload',
      label: 'Reload Workspace State',
      category: 'Actions',
      icon: <RotateCw className="w-4 h-4 text-slate-600" />,
      action: () => {
        onReload();
        onClose();
      },
    },
    {
      id: 'action_reset',
      label: 'Reset Demo Baseline State',
      category: 'Actions',
      icon: <RefreshCw className="w-4 h-4 text-rose-600" />,
      action: () => {
        onClose();
        onReset();
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/40 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[8px] border border-[#E5E7EB] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-2.5 border-b border-[#E5E7EB] bg-[#F8F9FA]">
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command, page, or action... (↑↓ to navigate, Esc to exit)"
            className="flex-1 bg-transparent text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-hidden"
          />
          <span className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] rounded px-1.5 py-0.5 bg-white shrink-0 ml-2">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-1.5 flex-1 divide-y divide-[#F3F4F6]">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              No commands matching "{search}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-[6px] transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-[#F3EDF2] text-[#714B67] font-semibold'
                      : 'text-[#374151] hover:bg-[#F9FAFB]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      isSelected
                        ? 'bg-[#E8DCE7] text-[#714B67]'
                        : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3.5 py-2 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span>Navigation & Operations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1 py-0.2 rounded border border-[#D1D5DB] bg-white font-mono text-[10px]">Enter</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
