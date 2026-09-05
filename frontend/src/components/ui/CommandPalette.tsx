import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  TrendingUp,
  TrendingDown,
  Plus,
} from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
}

type Category = 'Navigation' | 'Revenue' | 'Actions';

const CATEGORY_ORDER: Category[] = ['Navigation', 'Revenue', 'Actions'];

interface CommandItem {
  id: string;
  label: string;
  category: Category;
  icon: React.ReactNode;
  /** Extra search terms so an item is reachable by synonyms, not just its label. */
  keywords?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onReload }) => {
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

  const items: CommandItem[] = useMemo(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    return [
      // Navigation
      {
        id: 'nav_dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        keywords: 'home overview kpi metrics',
        icon: <LayoutDashboard className="w-4 h-4 text-[#714B67]" />,
        action: go('/dashboard'),
      },
      {
        id: 'nav_quotations',
        label: 'Open Quotations List',
        category: 'Navigation',
        keywords: 'quotes deals proposals pipeline',
        icon: <FileText className="w-4 h-4 text-[#714B67]" />,
        action: go('/quotations'),
      },
      {
        id: 'nav_approvals',
        label: 'Open Approvals Queue',
        category: 'Navigation',
        keywords: 'sign off review discount escalation pending',
        icon: <CheckSquare className="w-4 h-4 text-amber-600" />,
        action: go('/approvals'),
      },
      {
        id: 'nav_fulfillment',
        label: 'Open Fulfillment & Split Allocation',
        category: 'Navigation',
        keywords: 'warehouse shipping backorder delivery stock',
        icon: <Package className="w-4 h-4 text-blue-600" />,
        action: go('/fulfillment'),
      },
      {
        id: 'nav_subscriptions',
        label: 'Open Subscriptions & Hybrid Billing',
        category: 'Navigation',
        keywords: 'recurring mrr arr renewals proration',
        icon: <Repeat className="w-4 h-4 text-purple-600" />,
        action: go('/subscriptions'),
      },
      {
        id: 'nav_invoices',
        label: 'Open Invoices & Payment Settlement',
        category: 'Navigation',
        keywords: 'billing payments credit notes receivables',
        icon: <Receipt className="w-4 h-4 text-emerald-600" />,
        action: go('/invoices'),
      },
      {
        id: 'nav_deal_health',
        label: 'Open Deal Health Anomaly Triage',
        category: 'Navigation',
        keywords: 'risk margin discount anomaly alerts',
        icon: <Activity className="w-4 h-4 text-rose-600" />,
        action: go('/deal-health'),
      },
      {
        id: 'nav_reports',
        label: 'Open Reports & Analytics',
        category: 'Navigation',
        keywords: 'analytics charts revenue breakdown scorecard',
        icon: <BarChart3 className="w-4 h-4 text-cyan-600" />,
        action: go('/reports'),
      },
      {
        id: 'nav_products',
        label: 'Open Products Catalog',
        category: 'Navigation',
        keywords: 'catalog sku price list items',
        icon: <Boxes className="w-4 h-4 text-slate-600" />,
        action: go('/products'),
      },
      {
        id: 'nav_admin',
        label: 'Go to Back-end Configuration',
        category: 'Navigation',
        keywords: 'admin settings governance config',
        icon: <Sliders className="w-4 h-4 text-[#714B67]" />,
        action: go('/admin/products'),
      },

      // Revenue expansion — Upsell / Cross-sell / Down-sell
      {
        id: 'rev_upsell_rules',
        label: 'Upsell & Cross-Sell Rules',
        category: 'Revenue',
        keywords: 'upsell up-sell cross-sell expansion recommendations rules bundle attach',
        icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
        action: go('/admin/upsell-rules'),
      },
      {
        id: 'rev_downsell',
        label: 'Down-Sell & Retention Plays',
        category: 'Revenue',
        keywords: 'downsell down-sell discount retention save churn cheaper tier de-escalation',
        icon: <TrendingDown className="w-4 h-4 text-amber-600" />,
        action: go('/deal-health'),
      },
      {
        id: 'rev_opportunities',
        label: 'AI Upsell / Down-Sell Opportunities',
        category: 'Revenue',
        keywords: 'upsell downsell cross-sell ai suggestions expansion opportunity command center',
        icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
        action: go('/command-center'),
      },

      // Actions
      {
        id: 'action_new_quote',
        label: 'New Quotation Builder',
        category: 'Actions',
        keywords: 'create draft add quote',
        icon: <Plus className="w-4 h-4 text-emerald-600" />,
        action: go('/quotations/new'),
      },
      {
        id: 'nav_ai_command',
        label: 'Ask DealFlow360 AI / Command Center',
        category: 'Actions',
        keywords: 'assistant copilot chat agent',
        icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
        action: go('/command-center'),
      },
      {
        id: 'action_reload',
        label: 'Reload Workspace State',
        category: 'Actions',
        keywords: 'refresh sync reload',
        icon: <RotateCw className="w-4 h-4 text-slate-600" />,
        action: () => {
          onReload();
          onClose();
        },
      },
    ];
  }, [navigate, onClose, onReload]);

  // Token matching: every whitespace-separated term in the query must appear
  // somewhere in the item's label, category or keyword list.
  const filteredItems = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return items
      .filter((item) => {
        const haystack = `${item.label} ${item.category} ${item.keywords ?? ''}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  }, [items, search]);

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
      setSelectedIndex(
        (prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  let lastCategory: Category | null = null;

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
            placeholder="Search pages, revenue plays or actions — e.g. “upsell”, “invoices”, “risk”"
            className="flex-1 bg-transparent text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-hidden"
          />
          <span className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] rounded px-1.5 py-0.5 bg-white shrink-0 ml-2">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-1.5 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              No commands matching "{search}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const showHeader = item.category !== lastCategory;
              lastCategory = item.category;
              return (
                <React.Fragment key={item.id}>
                  {showHeader && (
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      {item.category}
                    </div>
                  )}
                  <button
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
                        isSelected ? 'bg-[#E8DCE7] text-[#714B67]' : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {item.category}
                    </span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3.5 py-2 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span>Navigation • Revenue • Operations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1 py-0.2 rounded border border-[#D1D5DB] bg-white font-mono text-[10px]">
              Enter
            </kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
