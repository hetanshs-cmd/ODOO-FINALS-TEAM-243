/**
 * DealFlow360 — Screen 1: Login / Signup & Role-Aware Entry
 * Production-like, enterprise-grade authentication for Internal Sales Workspace & Customer Portal.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  ShieldCheck,
  GitBranch,
  Boxes,
  Receipt,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Building2,
  User as UserIcon,
  Mail,
  Lock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';
import { VALID_TEAMS, TeamName } from '../services/authService';
import { toast } from '../components/ui/Toast';

type AuthMode = 'internal' | 'customer';
type InternalSubMode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const { login, signup, quickLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Mode states
  const [authMode, setAuthMode] = useState<AuthMode>('internal');
  const [internalSubMode, setInternalSubMode] = useState<InternalSubMode>('login');

  // Internal Login Form State
  const [internalEmail, setInternalEmail] = useState('');
  const [internalPassword, setInternalPassword] = useState('');
  const [internalTeam, setInternalTeam] = useState<TeamName>('Enterprise Accounts');
  const [showInternalPassword, setShowInternalPassword] = useState(false);

  // Internal Signup Form State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupTeam, setSignupTeam] = useState<TeamName>('Enterprise Accounts');
  const [signupRole, setSignupRole] = useState<UserRole>('sales_rep');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Customer Portal Form State (magic-link flow)
  const [customerEmail, setCustomerEmail] = useState('portal@dev.local');

  // Interaction / Validation State
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);

  // Client-side Validation Helper
  const validateEmailFormat = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Clear errors when switching modes or typing
  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (authFeedback) setAuthFeedback(null);
  };

  // =========================================================================
  // SUBMIT HANDLERS
  // =========================================================================

  const handleInternalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!internalEmail.trim()) {
      newErrors.email = 'Enter a valid email address.';
    } else if (!validateEmailFormat(internalEmail.trim())) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (!internalPassword) {
      newErrors.password = 'Password is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    setAuthFeedback(null);

    try {
      const res = await login({
        email: internalEmail,
        password: internalPassword,
        team: internalTeam,
        isCustomerPortal: false,
      });

      if (!res.success) {
        setAuthFeedback(res.error || 'The email or password does not match a demo account.');
        setIsLoading(false);
        return;
      }

      toast.success('Welcome back', `Logged in as ${res.user?.name} (${res.user?.title || res.user?.role})`);
      navigate(res.targetRoute);
    } catch {
      setAuthFeedback('An unexpected authentication error occurred. Please retry.');
      setIsLoading(false);
    }
  };

  const handleInternalSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!signupName.trim()) {
      newErrors.name = 'Full name is required.';
    }

    if (!signupEmail.trim() || !validateEmailFormat(signupEmail.trim())) {
      newErrors.email = 'Enter a valid work email address.';
    }

    if (!signupPassword) {
      newErrors.password = 'Password is required.';
    } else if (signupPassword.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }

    if (signupPassword !== signupConfirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!signupRole) {
      newErrors.role = 'Select a role before creating the account.';
    }

    if (!signupTeam) {
      newErrors.team = 'Select a Company / Team.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    setAuthFeedback(null);

    try {
      const res = await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
        team: signupTeam,
      });

      if (!res.success) {
        setAuthFeedback(res.error || 'Unable to create account.');
        setIsLoading(false);
        return;
      }

      toast.success('Account created successfully', `Logged in as ${res.user?.name}`);
      navigate(res.targetRoute);
    } catch {
      setAuthFeedback('Failed to register account. Please retry.');
      setIsLoading(false);
    }
  };

  // ── Customer Portal: two-step magic-link flow ──────────────────────────
  // Step 1: POST /portal/request-link. Step 2 (after "requestSent"):
  // POST /portal/verify-link with the token from the link (or pasted
  // manually / auto-verified from a ?token= query param — see effect below).
  const [portalStep, setPortalStep] = useState<'request' | 'sent'>('request');
  const [portalDevToken, setPortalDevToken] = useState<string | null>(null);
  const [portalVerifyToken, setPortalVerifyToken] = useState('');

  const handlePortalRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim() || !validateEmailFormat(customerEmail.trim())) {
      setErrors({ customerEmail: 'Enter a valid email address.' });
      return;
    }

    setErrors({});
    setIsLoading(true);
    setAuthFeedback(null);

    try {
      const { authService } = await import('../services/authService');
      const result = await authService.requestPortalLink(customerEmail.trim());
      setPortalDevToken(result.devToken || null);
      setPortalStep('sent');
      toast.info('Check your link', result.message);
    } catch {
      setAuthFeedback('Unable to request a secure access link right now. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortalVerifyLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = portalVerifyToken.trim();
    if (!token) {
      setErrors({ portalToken: 'Paste the token from your access link.' });
      return;
    }

    setErrors({});
    setIsLoading(true);
    setAuthFeedback(null);

    try {
      const { authService } = await import('../services/authService');
      const result = await authService.verifyPortalLink(token);
      if (!result.success) {
        setAuthFeedback(result.error || 'This link is invalid or has expired.');
        return;
      }
      toast.success('Procurement Portal', `Welcome, ${result.user?.name || 'there'}`);
      navigate(result.targetRoute);
    } catch {
      setAuthFeedback('Unable to verify this link. Please request a new one.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Account Trigger
  const handleQuickLogin = async (role: UserRole, emailHint?: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setAuthFeedback(null);
    setErrors({});

    try {
      const res = await quickLogin(role, emailHint);
      if (!res.success) {
        setAuthFeedback(res.error || 'Unable to activate this demo account.');
        return;
      }
      toast.success('Demo Account Activated', `Authenticated as ${res.user?.name} (${res.user?.title || res.user?.role})`);
      navigate(res.targetRoute);
    } catch {
      setAuthFeedback('Unable to sign in. Please retry when the server is available.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Trigger
  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !validateEmailFormat(forgotEmail.trim())) {
      setForgotFeedback('Please enter a valid email address to receive reset instructions.');
      return;
    }

    setForgotFeedback('Password recovery is not configured. Contact your administrator; no email has been sent.');
  };

  return (
    <div className="min-h-screen bg-[#1A141A] text-[#F3F4F6] flex flex-col md:flex-row antialiased font-sans selection:bg-[#714B67] selection:text-white">
      {/* ========================================================================= */}
      {/* LEFT PANEL: PRODUCT / VALUE STATEMENT                                   */}
      {/* ========================================================================= */}
      <section
        id="dealflow-product-panel"
        aria-label="DealFlow360 Overview"
        className="w-full md:w-5/12 lg:w-9/20 bg-[#221820] p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#382635] relative overflow-hidden"
      >
        {/* Subtle geometric structural accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#714B67]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#4A2D44]/15 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 space-y-8">
          {/* Brand & Identity */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#332230] border border-[#52374E] text-[#D8B4E2] text-xs font-semibold tracking-wide">
              <Layers className="w-4 h-4 text-[#C4B5FD] shrink-0" />
              <span>Commercial Governance Engine</span>
            </div>

            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">
                DealFlow<span className="text-[#C4B5FD]">360</span>
              </h1>
              <p className="text-base text-[#D1D5DB] font-medium mt-1">
                Intelligent, self-governing sales operations.
              </p>
            </div>

            <p className="text-sm text-[#9CA3AF] leading-relaxed max-w-md">
              Govern pricing, approvals, fulfillment, billing, and customer negotiation from one connected deal workflow.
            </p>
          </div>

          {/* Core Capabilities (Prompt 2 section 4) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-md bg-[#332230] border border-[#52374E] flex items-center justify-center text-[#D8B4E2] shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#E5E7EB] uppercase tracking-wider">
                  Govern discounts
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Live category ceilings, customer tiers, and blended deal risk controls.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-md bg-[#332230] border border-[#52374E] flex items-center justify-center text-[#D8B4E2] shrink-0 mt-0.5">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#E5E7EB] uppercase tracking-wider">
                  Route approvals
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Automatically route high-risk or margin-dilutive deals to the exact reviewer.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-md bg-[#332230] border border-[#52374E] flex items-center justify-center text-[#D8B4E2] shrink-0 mt-0.5">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#E5E7EB] uppercase tracking-wider">
                  Optimize fulfillment
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Coordinate multi-warehouse inventory splits and backorder delivery schedules.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-md bg-[#332230] border border-[#52374E] flex items-center justify-center text-[#D8B4E2] shrink-0 mt-0.5">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#E5E7EB] uppercase tracking-wider">
                  Reconcile billing
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Keep upfront hardware, milestone services, and recurring subscriptions aligned.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Strip (Prompt 2 section 27) */}
        <div className="relative z-10 pt-8 mt-8 border-t border-[#382635]">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">
            Autonomous Deal Lifecycle
          </div>
          <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-[#D1D5DB] overflow-x-auto py-1">
            <span className="px-2 py-1 rounded bg-[#2D1E2B] border border-[#442E41] text-[#E5E7EB]">Quote</span>
            <span className="text-[#6B7280]">→</span>
            <span className="px-2 py-1 rounded bg-[#2D1E2B] border border-[#442E41] text-[#C4B5FD]">Govern</span>
            <span className="text-[#6B7280]">→</span>
            <span className="px-2 py-1 rounded bg-[#2D1E2B] border border-[#442E41] text-[#FDE68A]">Approve</span>
            <span className="text-[#6B7280]">→</span>
            <span className="px-2 py-1 rounded bg-[#2D1E2B] border border-[#442E41] text-[#A7F3D0]">Fulfill</span>
            <span className="text-[#6B7280]">→</span>
            <span className="px-2 py-1 rounded bg-[#2D1E2B] border border-[#442E41] text-[#E9D5FF]">Bill</span>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <span>DealFlow360 • Development Workspace</span>
            <span>Deterministic Demo Baseline</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: AUTHENTICATION PANEL                                        */}
      {/* ========================================================================= */}
      <main
        id="dealflow-auth-panel"
        aria-label="User Authentication"
        className="w-full md:w-7/12 lg:w-11/20 bg-[#1A141A] p-6 sm:p-10 lg:p-14 flex items-center justify-center"
      >
        <div className="w-full max-w-md lg:max-w-lg bg-white text-[#1F2937] rounded-lg border border-[#E5E7EB] shadow-xl p-6 sm:p-7 space-y-5">
          {/* Active Session Notice if already logged in */}
          {isAuthenticated && (
            <div className="p-2.5 bg-[#F3EDF2] border border-[#E0D0DC] rounded-md flex items-center justify-between text-xs text-[#54374D]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#714B67] shrink-0" />
                <span>
                  Active session: <strong>{user.name}</strong> ({user.title || user.role})
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(user.role.toLowerCase() === 'customer' ? '/portal/quotation' : '/dashboard')}
                className="font-bold text-[#714B67] hover:underline ml-2 shrink-0 cursor-pointer"
              >
                Resume
              </button>
            </div>
          )}

          {/* Auth Header */}
          <div className="space-y-1 text-left">
            <h2 className="text-xl font-bold tracking-tight text-[#1F2937]">
              {authMode === 'internal'
                ? internalSubMode === 'login'
                  ? 'Welcome back'
                  : 'Create workspace account'
                : 'Customer Procurement Portal'}
            </h2>
            <p className="text-xs text-[#6B7280]">
              {authMode === 'internal'
                ? internalSubMode === 'login'
                  ? 'Log in to your workspace'
                  : 'Join your organization sales operations team'
                : 'Access your quotation, messages, and negotiation history.'}
            </p>
          </div>

          {/* Mode Switcher Tabs (Prompt 2 section 5) */}
          <div
            role="tablist"
            aria-label="Authentication Mode"
            className="grid grid-cols-2 p-1 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] text-xs font-semibold text-[#4B5563] select-none"
          >
            <button
              id="tab-internal-mode"
              role="tab"
              aria-selected={authMode === 'internal'}
              type="button"
              onClick={() => {
                setAuthMode('internal');
                setAuthFeedback(null);
                setErrors({});
              }}
              className={`py-1.5 px-3 rounded text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'internal'
                  ? 'bg-white text-[#1F2937] font-bold shadow-2xs border border-[#D1D5DB]'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Internal Workspace</span>
            </button>

            <button
              id="tab-customer-mode"
              role="tab"
              aria-selected={authMode === 'customer'}
              type="button"
              onClick={() => {
                setAuthMode('customer');
                setAuthFeedback(null);
                setErrors({});
              }}
              className={`py-1.5 px-3 rounded text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'customer'
                  ? 'bg-white text-[#714B67] font-bold shadow-2xs border border-[#D1D5DB]'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </button>
          </div>

          {/* Global Form Feedback / Error Banner */}
          {authFeedback && (
            <div
              id="auth-error-banner"
              role="alert"
              className="p-2.5 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{authFeedback}</div>
            </div>
          )}

          {/* ================================================================= */}
          {/* INTERNAL WORKSPACE LOGIN FORM                                     */}
          {/* ================================================================= */}
          {authMode === 'internal' && internalSubMode === 'login' && (
            <form onSubmit={handleInternalLogin} className="space-y-3.5" noValidate>
              {/* Work Email */}
              <div className="space-y-1">
                <label
                  htmlFor="internal-work-email"
                  className="block text-xs font-semibold text-[#374151]"
                >
                  Work email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="internal-work-email"
                    type="email"
                    autoComplete="username"
                    value={internalEmail}
                    onChange={(e) => {
                      setInternalEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    placeholder="sarah.chen@dealflow.demo"
                    className={`w-full text-xs bg-white text-[#1F2937] border rounded-md pl-8.5 pr-3 py-2 focus:outline-none focus:ring-2 transition-colors ${
                      errors.email
                        ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                        : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p id="internal-email-error" className="text-[11px] text-[#DC2626] font-medium">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="internal-password"
                    className="block text-xs font-semibold text-[#374151]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPasswordOpen(true);
                      setForgotEmail(internalEmail);
                    }}
                    className="text-[11px] font-medium text-[#714B67] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="internal-password"
                    type={showInternalPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={internalPassword}
                    onChange={(e) => {
                      setInternalPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    placeholder="Enter your password"
                    className={`w-full text-xs bg-white text-[#1F2937] border rounded-md pl-8.5 pr-9 py-2 focus:outline-none focus:ring-2 transition-colors ${
                      errors.password
                        ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                        : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInternalPassword(!showInternalPassword)}
                    aria-label={showInternalPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] cursor-pointer"
                  >
                    {showInternalPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="internal-password-error" className="text-[11px] text-[#DC2626] font-medium">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Company / Team Dropdown */}
              <div className="space-y-1">
                <label
                  htmlFor="internal-team-select"
                  className="block text-xs font-semibold text-[#374151]"
                >
                  Company / Team
                </label>
                <div className="relative">
                  <select
                    id="internal-team-select"
                    value={internalTeam}
                    onChange={(e) => setInternalTeam(e.target.value as TeamName)}
                    className="w-full text-xs bg-white text-[#1F2937] border border-[#D1D5DB] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67] cursor-pointer"
                  >
                    {VALID_TEAMS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-[#6B7280]">
                  Assigns operational routing boundaries and deal approval scope.
                </p>
              </div>

              {/* Submit Button */}
              <button
                id="btn-internal-login"
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#714B67] hover:bg-[#62415A] active:bg-[#54374D] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#714B67]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Sub-mode switch: Create Account */}
              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setInternalSubMode('signup');
                    setAuthFeedback(null);
                    setErrors({});
                  }}
                  className="text-xs text-[#4B5563] hover:text-[#714B67] font-medium cursor-pointer"
                >
                  New to DealFlow360? <span className="font-semibold text-[#714B67] underline">Create account</span>
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* INTERNAL WORKSPACE SIGNUP FORM                                    */}
          {/* ================================================================= */}
          {authMode === 'internal' && internalSubMode === 'signup' && (
            <form onSubmit={handleInternalSignup} className="space-y-3" noValidate>
              {/* Full Name */}
              <div className="space-y-1">
                <label
                  htmlFor="signup-name"
                  className="block text-xs font-semibold text-[#374151]"
                >
                  Full name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={signupName}
                  onChange={(e) => {
                    setSignupName(e.target.value);
                    clearFieldError('name');
                  }}
                  placeholder="e.g. Sarah Chen"
                  className={`w-full text-xs bg-white text-[#1F2937] border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                    errors.name
                      ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                      : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                  }`}
                />
                {errors.name && (
                  <p id="signup-name-error" className="text-[11px] text-[#DC2626] font-medium">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Work Email */}
              <div className="space-y-1">
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-semibold text-[#374151]"
                >
                  Work email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="sarah.chen@dealflow.demo"
                  className={`w-full text-xs bg-white text-[#1F2937] border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                    errors.email
                      ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                      : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                  }`}
                />
                {errors.email && (
                  <p id="signup-email-error" className="text-[11px] text-[#DC2626] font-medium">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-semibold text-[#374151]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={signupPassword}
                      onChange={(e) => {
                        setSignupPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      placeholder="Min 8 characters"
                      className={`w-full text-xs bg-white text-[#1F2937] border rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                        errors.password
                          ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                          : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] cursor-pointer"
                    >
                      {showSignupPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="signup-password-error" className="text-[10px] text-[#DC2626] font-medium">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-[#374151]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={signupConfirmPassword}
                    onChange={(e) => {
                      setSignupConfirmPassword(e.target.value);
                      clearFieldError('confirmPassword');
                    }}
                    placeholder="Re-enter password"
                    className={`w-full text-xs bg-white text-[#1F2937] border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                      errors.confirmPassword
                        ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                        : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                    }`}
                  />
                  {errors.confirmPassword && (
                    <p id="signup-confirm-error" className="text-[10px] text-[#DC2626] font-medium">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              {/* Company / Team & Role Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="signup-team"
                    className="block text-xs font-semibold text-[#374151]"
                  >
                    Company / Team
                  </label>
                  <select
                    id="signup-team"
                    value={signupTeam}
                    onChange={(e) => setSignupTeam(e.target.value as TeamName)}
                    className="w-full text-xs bg-white text-[#1F2937] border border-[#D1D5DB] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67] cursor-pointer"
                  >
                    {VALID_TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="signup-role"
                    className="block text-xs font-semibold text-[#374151]"
                  >
                    Internal Role
                  </label>
                  <select
                    id="signup-role"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as UserRole)}
                    className="w-full text-xs bg-white text-[#1F2937] border border-[#D1D5DB] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67] cursor-pointer"
                  >
                    <option value="sales_rep">Sales Representative</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn-internal-signup"
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#714B67] hover:bg-[#62415A] active:bg-[#54374D] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#714B67]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registering workspace user...</span>
                  </>
                ) : (
                  <>
                    <span>Create Workspace Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setInternalSubMode('login');
                    setAuthFeedback(null);
                    setErrors({});
                  }}
                  className="text-xs text-[#4B5563] hover:text-[#714B67] font-medium cursor-pointer"
                >
                  Already have an account? <span className="font-semibold text-[#714B67] underline">Log in</span>
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* CUSTOMER PORTAL LOGIN FORM                                        */}
          {/* ================================================================= */}
          {authMode === 'customer' && portalStep === 'request' && (
            <form onSubmit={handlePortalRequestLink} className="space-y-3.5" noValidate>
              <div className="p-2.5 bg-[#F3EDF2] border border-[#E0D0DC] rounded-md text-xs text-[#54374D]">
                <span className="font-semibold">Procurement Sourcing:</span> Review submitted
                proposals, submit pricing counter-offers, and view order fulfillment progress.
                Sign-in uses a secure one-time access link — no password needed.
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label
                  htmlFor="customer-email"
                  className="block text-xs font-semibold text-[#374151]"
                >
                  Work or procurement email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="customer-email"
                    type="email"
                    autoComplete="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      clearFieldError('customerEmail');
                    }}
                    placeholder="portal@dev.local"
                    className={`w-full text-xs bg-white text-[#1F2937] border rounded-md pl-8.5 pr-3 py-2 focus:outline-none focus:ring-2 transition-colors ${
                      errors.customerEmail
                        ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                        : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                    }`}
                  />
                </div>
                {errors.customerEmail && (
                  <p id="customer-email-error" className="text-[11px] text-[#DC2626] font-medium">
                    {errors.customerEmail}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                id="btn-customer-request-link"
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#714B67] hover:bg-[#62415A] active:bg-[#54374D] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#714B67]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending secure link...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Send Me a Secure Access Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {authMode === 'customer' && portalStep === 'sent' && (
            <form onSubmit={handlePortalVerifyLink} className="space-y-3.5" noValidate>
              <div className="p-2.5 bg-[#F3EDF2] border border-[#E0D0DC] rounded-md text-xs text-[#54374D] space-y-1">
                <div className="font-semibold">Check your link</div>
                <div>
                  If <span className="font-medium">{customerEmail}</span> is registered for portal
                  access, we've sent a one-time sign-in link. Open it on this device to continue,
                  or paste its token below.
                </div>
              </div>

              {portalDevToken && (
                <div className="p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-md text-[11px] text-[#92400E] break-all">
                  <span className="font-semibold">Dev mode token</span> (no email service configured):
                  <br />
                  <code>{portalDevToken}</code>
                </div>
              )}

              {/* Token */}
              <div className="space-y-1">
                <label htmlFor="portal-token" className="block text-xs font-semibold text-[#374151]">
                  Access link token
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="portal-token"
                    type="text"
                    value={portalVerifyToken}
                    onChange={(e) => {
                      setPortalVerifyToken(e.target.value);
                      clearFieldError('portalToken');
                    }}
                    placeholder="Paste the token from your link"
                    className={`w-full text-xs bg-white text-[#1F2937] border rounded-md pl-8.5 pr-3 py-2 focus:outline-none focus:ring-2 transition-colors ${
                      errors.portalToken
                        ? 'border-[#F87171] focus:ring-[#FCA5A5]'
                        : 'border-[#D1D5DB] focus:ring-[#714B67]/20 focus:border-[#714B67]'
                    }`}
                  />
                </div>
                {errors.portalToken && (
                  <p className="text-[11px] text-[#DC2626] font-medium">{errors.portalToken}</p>
                )}
              </div>

              <button
                id="btn-customer-verify-link"
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#714B67] hover:bg-[#62415A] active:bg-[#54374D] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#714B67]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting to portal...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Customer Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-1.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setPortalStep('request');
                    setPortalDevToken(null);
                    setPortalVerifyToken('');
                    setAuthFeedback(null);
                  }}
                  className="text-xs text-[#4B5563] hover:text-[#714B67] font-medium cursor-pointer"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* DEMO ACCOUNTS SECTION (Prompt 2 section 13)                        */}
          {/* ================================================================= */}
          <div
            id="dealflow-demo-accounts"
            className="pt-3.5 border-t border-[#F3F4F6] space-y-2 text-left"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
              <span>Demo Accounts (Quick Access)</span>
              <span className="text-[9px] font-mono text-[#714B67] bg-[#F3EDF2] px-1.5 py-0.5 rounded font-semibold">
                Fast Login
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                id="demo-login-sales-rep"
                type="button"
                onClick={() => handleQuickLogin('sales_rep')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate">
                  Sales Rep
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">rep@dev.local</div>
              </button>

              <button
                id="demo-login-sales-manager"
                type="button"
                onClick={() => handleQuickLogin('sales_manager')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate">
                  Sales Manager
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">manager@dev.local</div>
              </button>

              <button
                id="demo-login-finance"
                type="button"
                onClick={() => handleQuickLogin('finance')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate">
                  Finance
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">finance@dev.local</div>
              </button>

              <button
                id="demo-login-admin"
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate">
                  Admin
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">admin@dev.local</div>
              </button>

              <button
                id="demo-login-customer-meridian"
                type="button"
                onClick={() => handleQuickLogin('customer', 'priya.nair@meridianindustrial.com')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate flex items-center justify-between">
                  <span>Customer (Meridian)</span>
                  <span className="text-[9px] text-[#714B67] bg-[#F3EDF2] px-1 rounded font-medium">Portal</span>
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">priya.nair@meridianindustrial.com</div>
              </button>

              <button
                id="demo-login-customer"
                type="button"
                onClick={() => handleQuickLogin('customer', 'portal@dev.local')}
                className="p-2 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-[#F3EDF2] hover:border-[#714B67] transition-all text-left group cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-[#1F2937] group-hover:text-[#714B67] truncate flex items-center justify-between">
                  <span>Customer</span>
                  <span className="text-[9px] text-[#714B67] bg-[#F3EDF2] px-1 rounded font-medium">Portal</span>
                </div>
                <div className="text-[10px] text-[#6B7280] truncate">portal@dev.local</div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL (Prompt 2 section 20)                              */}
      {/* ========================================================================= */}
      {isForgotPasswordOpen && (
        <div
          id="modal-forgot-password"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
        >
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl p-5 max-w-sm w-full space-y-3.5 text-[#1F2937] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#714B67]" />
                <h3 id="forgot-password-title" className="text-xs font-bold text-[#1F2937]">
                  Reset Account Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setForgotFeedback(null);
                }}
                className="text-[#9CA3AF] hover:text-[#4B5563] p-1 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#4B5563] leading-relaxed">
              Enter your work email address. We will simulate sending instructions to reset your password for this demo session.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#374151]">
                  Work email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@dealflow.demo"
                  className="w-full text-xs bg-white text-[#1F2937] border border-[#D1D5DB] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                />
              </div>

              {forgotFeedback && (
                <div className="p-2 rounded bg-[#F3EDF2] border border-[#E0D0DC] text-[11px] text-[#54374D]">
                  {forgotFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setForgotFeedback(null);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-[#374151] border border-[#D1D5DB] rounded-md hover:bg-[#F8F9FA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#714B67] hover:bg-[#62415A] rounded-md shadow-2xs cursor-pointer"
                >
                  Send Recovery Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
