/**
 * DealFlow360 — Customer Portal Shell (Screen 11 Isolation)
 * Strict customer boundary layout: no internal workspace controls, no backend links, no margin/risk indicators.
 */

import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FileText, MessageSquare, User, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePortalProfile, usePortalNegotiations } from '../hooks/usePortal';

export const PortalShell: React.FC = () => {
  const { user, logout } = useAuth();
  const { profile } = usePortalProfile();
  const { negotiations } = usePortalNegotiations();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const openNegotiationsCount = negotiations.filter(
    (n) => n.status === 'OPEN' || n.status === 'IN_PROGRESS'
  ).length;

  const navLinks = [
    { label: 'My Quotation', path: '/portal/quotation', icon: <FileText className="w-4 h-4" /> },
    {
      label: 'Messages',
      path: '/portal/messages',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: openNegotiationsCount > 0 ? openNegotiationsCount : undefined,
    },
    { label: 'Profile', path: '/portal/profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#1F2937] font-sans antialiased">
      {/* Customer Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#714B67] flex items-center justify-center text-white font-bold text-xs shadow-2xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1F2937] tracking-tight text-sm">DealFlow360</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F3EDF2] text-[#714B67] border border-[#E0D0DC]">
                  Customer Portal
                </span>
              </div>
            </div>
          </div>

          {/* Customer User Identity & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#1F2937]">{user.name}</span>
              <span className="text-[11px] text-[#6B7280]">
                {profile?.company_name ?? '—'}
              </span>
            </div>

            <div className="relative w-8 h-8 rounded-full bg-[#714B67] text-white border border-[#5d3b53] flex items-center justify-center font-bold text-[11px] shadow-2xs">
              <span>{user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
              <span
                className="absolute -bottom-1 -right-1 bg-white rounded-full ring-1 ring-[#E0D0DC] p-[1px] text-[#714B67]"
                aria-hidden="true"
              >
                <User className="w-2.5 h-2.5" />
              </span>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              id="portal-btn-signout"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#DC2626] hover:bg-[#FEF2F2] border border-[#E5E7EB] hover:border-red-200 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer shadow-2xs"
              title="Sign Out of Customer Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Customer Navigation Bar (Prompt Section 6: My Quotation | Messages | Profile) */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex border-t border-[#F3F4F6] gap-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? 'border-[#714B67] text-[#714B67] font-bold'
                    : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
                }`
              }
            >
              {link.icon}
              <span>{link.label}</span>
              {link.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#714B67] text-white">
                  {link.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </header>

      {/* Customer Portal Content Surface */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {location.pathname !== '/portal/quotation' && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 mb-3 text-xs font-semibold text-[#4B5563] hover:text-[#714B67] border border-[#E5E7EB] px-2.5 py-1.5 rounded-md transition-colors cursor-pointer shadow-2xs bg-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        )}
        <Outlet />
      </main>

      {/* Trust & Security Footer */}
      <footer className="bg-white border-t border-[#E5E7EB] py-3.5 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#9CA3AF] gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
            <span>Secure Commercial Procurement Session • ISO 27001 Certified Governance</span>
          </div>
          <span className="text-[11px] text-slate-400">DealFlow360 Enterprise Governance</span>
        </div>
      </footer>
    </div>
  );
};
