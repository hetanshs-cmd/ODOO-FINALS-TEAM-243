/**
 * DealFlow360 — Route Protection & Governance Guard
 * Enforces session authentication and strict role separation (Internal vs Customer Portal).
 */

import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import { Permission, hasPermission } from '../../constants/permissions';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '../ui/Button';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireInternal?: boolean;
  requiredPermission?: Permission;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireInternal = false,
  requiredPermission,
  allowedRoles,
}) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Unauthenticated users are redirected to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isCustomer = user.role.toLowerCase() === 'customer';

  // 2. Customer accounts are strictly barred from internal workspace shells
  if (requireInternal && isCustomer) {
    return <Navigate to="/portal/quotation" replace />;
  }

  // 3. Check allowed roles if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedUserRole = user.role.toLowerCase().replace('_', '');
    const isAllowed = allowedRoles.some(
      (r) => r.toLowerCase().replace('_', '') === normalizedUserRole
    );
    if (!isAllowed) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">
            403 • Authorization Restricted
          </span>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Governance Clearance Required
          </h2>
          <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
            Your account ({user.name}, {user.title || user.role}) is not assigned administrative
            governance privileges for this module.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 text-xs bg-slate-900 hover:bg-slate-800 text-white"
            >
              <LayoutDashboard className="w-4 h-4" />
              Return to Dashboard
            </Button>
          </div>
        </div>
      );
    }
  }

  // 4. Check specific permission if specified
  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
          Permission Restricted
        </span>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Administrative Permission Required
        </h2>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          Accessing this configuration requires the <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">{requiredPermission}</code> permission.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-xs bg-slate-900 hover:bg-slate-800 text-white"
        >
          <LayoutDashboard className="w-4 h-4" />
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return children;
};
