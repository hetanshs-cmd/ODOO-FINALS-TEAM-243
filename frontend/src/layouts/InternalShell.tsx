import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Package,
  Repeat,
  Receipt,
  Activity,
  BarChart3,
  Boxes,
  Search,
  RotateCw,
  Plus,
  UserCheck,
  LogOut,
  ArrowLeft,
  Bell,
  Menu,
  X,
  Layers,
  ChevronDown,
  Sparkles,
  Command,
  MessageSquare,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQuotations } from '../hooks/useQuotations';
import { useDealHealthAlerts } from '../hooks/useDealHealth';
import { toast } from '../components/ui/Toast';
import { CommandPalette } from '../components/ui/CommandPalette';
import { ChatWidget } from '../components/ai/ChatWidget';
import { UserRole } from '../types';

// Mirrors the backend's requireRole() allow-list for GET /quotations and
// GET /deal-health (see docs/api.md) — FINANCE and OPERATIONS can't read
// either, so fetching them unconditionally here (just for sidebar badge
// counts) 403'd on every page load for those roles.
const PIPELINE_VISIBLE_ROLES: UserRole[] = ['sales_rep', 'sales_manager', 'admin'];

export const InternalShell: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const canViewPipeline = hasRole(PIPELINE_VISIBLE_ROLES);
  const { quotations, refetch: refetchQuotations } = useQuotations(undefined, canViewPipeline);
  const { alerts, refetch: refetchAlerts } = useDealHealthAlerts(undefined, canViewPipeline);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut: Ctrl/Cmd + K to open Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If a customer user accesses internal shell, strictly redirect to portal quotation
  if (user.role.toLowerCase() === 'customer') {
    return <Navigate to="/portal/quotation" replace />;
  }

  // The "Customer Portal" quick-link is a dead end for these internal roles —
  // it points at /portal/quotation, which only a portal-scoped (customer) token can
  // access, so clicking it as an internal user has no actual significance.
  const showCustomerPortalLink = !['sales_rep', 'sales_manager', 'admin', 'finance'].includes(
    user.role.toLowerCase()
  );

  const pendingApprovalsCount = quotations.filter((q) => q.status === 'PENDING_APPROVAL').length;

  // Exact 9 navigation items in required order (Section 8)
  interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Quotations',
      path: '/quotations',
      icon: <FileText className="w-4 h-4 shrink-0" />,
      badge: quotations.length,
    },
    {
      label: 'Approvals',
      path: '/approvals',
      icon: <CheckSquare className="w-4 h-4 shrink-0" />,
      badge: pendingApprovalsCount,
      badgeColor: 'bg-amber-100 text-amber-800 border border-amber-200',
    },
    {
      label: 'Fulfillment',
      path: '/fulfillment',
      icon: <Package className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Subscriptions',
      path: '/subscriptions',
      icon: <Repeat className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Invoices',
      path: '/invoices',
      icon: <Receipt className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Negotiations',
      path: '/negotiations',
      icon: <MessageSquare className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Deal Health',
      path: '/deal-health',
      icon: <Activity className="w-4 h-4 shrink-0" />,
      badge: alerts.length,
      badgeColor: 'bg-rose-100 text-rose-800 border border-rose-200',
    },
    {
      label: 'Reports',
      path: '/reports',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Products',
      path: '/products',
      icon: <Boxes className="w-4 h-4 shrink-0" />,
    },
  ];

  const handleReloadData = () => {
    refetchQuotations();
    refetchAlerts();
    toast.success('Workspace Refreshed', 'Application state synchronized with live deal desk.');
  };

  const handleCloseWorkspace = () => {
    logout();
    navigate('/login');
    toast.info('Workspace Closed', 'Session concluded.');
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quotations?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#1F2937] font-sans antialiased">
      {/* 1. TOPBAR (48–56px) — Section 12 */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] h-[52px] px-3 sm:px-4 flex items-center justify-between shadow-2xs">
        {/* LEFT: Logo & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8F9FA] rounded-[6px] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <Link to="/dashboard" className="flex items-center gap-2 group" title="DealFlow360 Workspace">
            <div className="w-7 h-7 rounded-[6px] bg-[#714B67] flex items-center justify-center text-white font-bold text-xs shadow-2xs group-hover:bg-[#62415A] transition-colors">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-baseline">
              <span className="text-base font-bold tracking-tight text-[#1F2937]">DealFlow</span>
              <span className="text-base font-bold tracking-tight text-[#714B67]">360</span>
            </div>
          </Link>
        </div>

        {/* CENTER: Global Search & Command Palette Trigger (Section 10 & 52) */}
        <div className="hidden sm:block flex-1 max-w-xs md:max-w-sm mx-4">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between bg-[#F8F9FA] hover:bg-white border border-[#D1D5DB] rounded-[6px] text-xs pl-2.5 pr-2 py-1 h-8 text-[#1F2937] transition-all cursor-pointer text-left shadow-2xs group"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#714B67] shrink-0" />
              <span className="text-[#9CA3AF] text-xs truncate">Search or jump to...</span>
            </div>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-[#9CA3AF] bg-white border border-[#E5E7EB] px-1.5 py-0.5 rounded shadow-2xs shrink-0">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* RIGHT: Operational Workspace Controls (Section 10 & 12) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* AI Command Center Quick Launch */}
          <Link
            to="/command-center"
            title="AI Command Center"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100 rounded-[6px] border border-indigo-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">AI Assist</span>
          </Link>

          {/* Reload Data Button (Section 57) */}
          <button
            type="button"
            onClick={handleReloadData}
            title="Reload canonical workspace state"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8F9FA] rounded-[6px] border border-transparent hover:border-[#E5E7EB] transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Reload</span>
          </button>

          {/* Notifications Icon with pending approvals indicator */}
          <Link
            to="/approvals"
            title="Pending Approvals & Alerts"
            className="relative p-1.5 text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8F9FA] rounded-[6px] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
            )}
          </Link>

          {/* User Profile Area (Section 12: Sarah Chen / Sales Rep) */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-[#E5E7EB]">
            <div className="relative w-7 h-7 rounded-full bg-[#714B67] text-white border border-[#5d3b53] flex items-center justify-center font-bold text-xs shadow-2xs">
              <span>{user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
              <span
                className="absolute -bottom-1 -right-1 bg-white rounded-full ring-1 ring-[#E8DCE7] p-[1px] text-[#714B67]"
                aria-hidden="true"
              >
                <UserRound className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs font-semibold text-[#1F2937] truncate max-w-[110px]">
                {user.name}
              </div>
              <div className="text-[11px] text-[#6B7280]">
                {user.title || (user.role === 'SalesRep' ? 'Sales Rep' : user.role)}
              </div>
            </div>
          </div>

          {/* Close Workspace (Logout) */}
          <button
            type="button"
            onClick={handleCloseWorkspace}
            title="Close Workspace / Logout"
            className="p-1.5 text-[#6B7280] hover:text-rose-700 hover:bg-rose-50 rounded-[6px] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. BODY LAYOUT: Compact Left Sidebar + Operational Page Content */}
      <div className="flex-1 flex min-h-[calc(100vh-52px)]">
        {/* Desktop Compact Left Navigation (Section 11, Width ~224px / w-56) */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-[#E5E7EB] select-none">
          {/* Main ERP Sidebar Items */}
          <nav className="flex-1 p-2 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-[6px] text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#F4EEF3] text-[#714B67] font-semibold border-l-2 border-[#714B67]'
                      : 'text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8F9FA]'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (typeof item.badge === 'number' ? item.badge > 0 : Boolean(item.badge)) && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                      item.badgeColor || 'bg-[#F3F4F6] text-[#4B5563]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Sidebar Footer Actions */}
          <div className="p-3 border-t border-[#E5E7EB] space-y-2">
            <button
              type="button"
              onClick={() => navigate('/quotations/new')}
              className="w-full bg-[#714B67] hover:bg-[#62415A] text-white text-xs font-semibold px-3 py-2 rounded-[6px] shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quotation</span>
            </button>

            {showCustomerPortalLink && (
              <Link
                to="/portal/quotation"
                className="flex items-center justify-center gap-1.5 text-[11px] text-[#714B67] hover:text-[#62415A] font-medium py-1 text-center"
                title="Open Customer Procurement & Negotiation Portal"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Customer Portal</span>
              </Link>
            )}
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/30 backdrop-blur-2xs flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col justify-between border-r border-[#E5E7EB] shadow-xl animate-in slide-in-from-left duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-[6px] bg-[#714B67] flex items-center justify-center text-white font-bold text-xs">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-sm text-[#1F2937]">DealFlow360</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-[#6B7280] hover:text-[#1F2937]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-[6px] text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-[#F4EEF3] text-[#714B67] font-semibold border-l-2 border-[#714B67]'
                            : 'text-[#4B5563] hover:bg-[#F8F9FA]'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (typeof item.badge === 'number' ? item.badge > 0 : Boolean(item.badge)) && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#F3F4F6] text-[#4B5563]">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/quotations/new');
                  }}
                  className="w-full bg-[#714B67] text-white text-xs font-semibold py-2 rounded-[6px] flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Quotation</span>
                </button>
                {showCustomerPortalLink && (
                  <Link
                    to="/portal/quotation"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-center text-xs text-[#714B67] font-medium py-1"
                  >
                    Open Customer Portal
                  </Link>
                )}
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        {/* Operational Page Content Area (Section 10) */}
        <main className="flex-1 min-w-0 bg-[#F8F9FA] overflow-y-auto">
          <div className="max-w-[1600px] w-full mx-auto p-4 sm:p-5 lg:p-6">
            {location.pathname !== '/dashboard' && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 mb-3 text-xs font-semibold text-[#4B5563] hover:text-[#714B67] hover:bg-white border border-[#E5E7EB] px-2.5 py-1.5 rounded-[6px] transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Command Palette (Section 52: Ctrl/Cmd + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onReload={handleReloadData}
      />

      {/* Floating Workspace Assistant (Part D: real-model chat + instant nav answers) */}
      <ChatWidget />
    </div>
  );
};
