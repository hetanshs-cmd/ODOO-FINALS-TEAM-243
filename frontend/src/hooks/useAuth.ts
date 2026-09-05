/**
 * DealFlow360 — Authentication & Session Hook
 * Manages active user identity, role-aware permissions, and session access control.
 */

import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { dealStore } from '../store/dealStore';
import { hasPermission, Permission } from '../constants/permissions';
import { authService, LoginCredentials, SignupCredentials, AuthResult } from '../services/authService';

export interface AuthContextValue {
  user: User;
  isAuthenticated: boolean;
  selectedTeam: string;
  login: (credentials: LoginCredentials) => Promise<AuthResult>;
  signup: (credentials: SignupCredentials) => Promise<AuthResult>;
  quickLogin: (role: UserRole, specificEmailOrId?: string) => AuthResult;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  can: (permission: Permission) => boolean;
}

export function useAuth(): AuthContextValue {
  const [currentUser, setCurrentUser] = useState<User>(dealStore.getState().currentUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(dealStore.getState().isAuthenticated);
  const [selectedTeam, setSelectedTeam] = useState<string>(dealStore.getState().selectedTeam || 'Enterprise Accounts');

  useEffect(() => {
    const unsubscribe = dealStore.subscribe(() => {
      const state = dealStore.getState();
      setCurrentUser(state.currentUser);
      setIsAuthenticated(state.isAuthenticated);
      setSelectedTeam(state.selectedTeam || 'Enterprise Accounts');
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResult> => {
    return authService.login(credentials);
  }, []);

  const signup = useCallback(async (credentials: SignupCredentials): Promise<AuthResult> => {
    return authService.signup(credentials);
  }, []);

  const quickLogin = useCallback((role: UserRole, specificEmailOrId?: string): AuthResult => {
    return authService.quickLoginByRole(role, specificEmailOrId);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      const currentRole = currentUser.role.toLowerCase().replace('_', '');
      if (Array.isArray(role)) {
        return role.some((r) => r.toLowerCase().replace('_', '') === currentRole);
      }
      return role.toLowerCase().replace('_', '') === currentRole;
    },
    [currentUser.role]
  );

  const can = useCallback(
    (permission: Permission) => {
      return hasPermission(currentUser.role, permission);
    },
    [currentUser.role]
  );

  return {
    user: currentUser,
    isAuthenticated,
    selectedTeam,
    login,
    signup,
    quickLogin,
    logout,
    hasRole,
    can,
  };
}
