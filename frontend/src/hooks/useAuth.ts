/**
 * DealFlow360 — Authentication & Session Hook
 * Hydrates the current user by decoding the stored JWT on load (there is no
 * `/auth/me` endpoint), and exposes login/signup/logout backed by the real
 * backend via authService. Session state lives in this hook + localStorage
 * (via tokenStore) — no dependency on the mock dealStore.
 */

import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { hasPermission, Permission } from '../constants/permissions';
import { authService, LoginCredentials, SignupCredentials, AuthResult } from '../services/authService';
import { tokenStore } from '../services/tokenStore';
import { decodeJwt, isJwtExpired } from '../utils/jwt';

export interface AuthContextValue {
  user: User;
  isAuthenticated: boolean;
  selectedTeam: string;
  login: (credentials: LoginCredentials) => Promise<AuthResult>;
  signup: (credentials: SignupCredentials) => Promise<AuthResult>;
  quickLogin: (role: UserRole, specificEmailOrId?: string) => Promise<AuthResult>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  can: (permission: Permission) => boolean;
  setSessionUser: (user: User) => void;
}

const ANONYMOUS_USER: User = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'sales_rep',
  active: false,
};

function hydrateFromToken(): { user: User | null; isAuthenticated: boolean } {
  const token = tokenStore.getToken();
  if (!token) return { user: null, isAuthenticated: false };

  const payload = decodeJwt(token);
  if (!payload || isJwtExpired(payload)) {
    tokenStore.clearToken();
    return { user: null, isAuthenticated: false };
  }

  if (payload.scope === 'portal') {
    return {
      user: {
        id: payload.sub,
        name: 'Customer',
        email: '',
        role: 'CUSTOMER',
        active: true,
        customerId: payload.customerId,
      },
      isAuthenticated: true,
    };
  }

  return {
    user: {
      id: payload.sub,
      name: '',
      email: '',
      role: (payload.role as UserRole) || 'sales_rep',
      active: true,
    },
    isAuthenticated: true,
  };
}

export function useAuth(): AuthContextValue {
  const initial = hydrateFromToken();
  const [currentUser, setCurrentUser] = useState<User | null>(initial.user);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initial.isAuthenticated);
  const [selectedTeam, setSelectedTeam] = useState<string>('Enterprise Accounts');

  // Re-hydrate if the token changes in another tab.
  useEffect(() => {
    const onStorage = () => {
      const next = hydrateFromToken();
      setCurrentUser(next.user);
      setIsAuthenticated(next.isAuthenticated);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const applyAuthResult = useCallback((result: AuthResult, team?: string) => {
    if (result.success && result.user) {
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      if (team) setSelectedTeam(team);
    }
    return result;
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResult> => {
      const result = await authService.login(credentials);
      return applyAuthResult(result, credentials.team);
    },
    [applyAuthResult]
  );

  const signup = useCallback(
    async (credentials: SignupCredentials): Promise<AuthResult> => {
      const result = await authService.signup(credentials);
      return applyAuthResult(result, credentials.team);
    },
    [applyAuthResult]
  );

  const quickLogin = useCallback(
    async (role: UserRole, specificEmailOrId?: string): Promise<AuthResult> => {
      const result = await authService.quickLoginByRole(role, specificEmailOrId);
      return applyAuthResult(result);
    },
    [applyAuthResult]
  );

  const logout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      const currentRole = (currentUser?.role || '').toLowerCase().replace(/_/g, '');
      if (Array.isArray(role)) {
        return role.some((r) => r.toLowerCase().replace(/_/g, '') === currentRole);
      }
      return role.toLowerCase().replace(/_/g, '') === currentRole;
    },
    [currentUser?.role]
  );

  const can = useCallback(
    (permission: Permission) => {
      return hasPermission(currentUser?.role || 'sales_rep', permission);
    },
    [currentUser?.role]
  );

  const setSessionUser = useCallback((user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  }, []);

  return {
    user: currentUser || ANONYMOUS_USER,
    isAuthenticated,
    selectedTeam,
    login,
    signup,
    quickLogin,
    logout,
    hasRole,
    can,
    setSessionUser,
  };
}
