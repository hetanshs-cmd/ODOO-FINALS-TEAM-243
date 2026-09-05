/**
 * DealFlow360 — Dedicated Authentication Service
 * Mock & swappable authentication provider supporting deterministic demo accounts and internal signup.
 */

import { User, UserRole } from '../types';
import { dealStore } from '../store/dealStore';

export interface LoginCredentials {
  email: string;
  password?: string;
  team?: string;
  isCustomerPortal?: boolean;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  team: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  targetRoute: string;
  error?: string;
}

export const VALID_TEAMS = [
  'Enterprise Accounts',
  'Strategic Accounts',
  'North Region Sales',
  'Operations',
] as const;

export type TeamName = (typeof VALID_TEAMS)[number];

class AuthService {
  /**
   * Log in user using email and password
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Simulated realistic enterprise auth verification delay (300-400ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password?.trim() || '';
    const users = dealStore.getState().users;

    if (!email) {
      return { success: false, targetRoute: '/login', error: 'Enter a valid email address.' };
    }
    if (!password) {
      return { success: false, targetRoute: '/login', error: 'Password is required.' };
    }

    // Match by email (case-insensitive) or demo alias
    let matchedUser = users.find(
      (u) =>
        u.email.toLowerCase() === email ||
        u.email.toLowerCase().replace('@dealflow360.internal', '@dealflow.demo') === email ||
        u.email.toLowerCase().split('@')[0] === email.split('@')[0]
    );

    // If in Customer mode, ensure user is a customer
    if (credentials.isCustomerPortal) {
      if (matchedUser && matchedUser.role.toLowerCase() !== 'customer') {
        return {
          success: false,
          targetRoute: '/login',
          error: 'This account belongs to the internal workspace. Please switch to Internal Workspace.',
        };
      }
      // If customer not found, check if it matches demo customer
      if (!matchedUser && (email.includes('acme') || email.includes('mehta') || email.includes('customer') || email.includes('meridian'))) {
        matchedUser = users.find((u) => u.role.toLowerCase() === 'customer');
      }
    } else {
      // In Internal mode, forbid customer login
      if (matchedUser && matchedUser.role.toLowerCase() === 'customer') {
        return {
          success: false,
          targetRoute: '/login',
          error: 'Customer portal credentials cannot be used for internal workspace login. Switch to Customer Portal.',
        };
      }
    }

    if (!matchedUser) {
      return {
        success: false,
        targetRoute: '/login',
        error: 'The email or password does not match a demo account.',
      };
    }

    // Check password (for demo purposes, any password of 3+ chars or standard passwords pass for seeded users)
    if (password.length < 3) {
      return {
        success: false,
        targetRoute: '/login',
        error: 'Password must be at least 3 characters long.',
      };
    }

    // Authenticate in store
    dealStore.loginUser(matchedUser, credentials.team || 'Enterprise Accounts');

    const targetRoute = matchedUser.role.toLowerCase() === 'customer' ? '/portal/quotation' : '/dashboard';

    return {
      success: true,
      user: matchedUser,
      targetRoute,
    };
  }

  /**
   * Internal user registration
   */
  public async signup(credentials: SignupCredentials): Promise<AuthResult> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const email = credentials.email.trim().toLowerCase();
    const name = credentials.name.trim();
    const password = credentials.password.trim();

    if (!name) {
      return { success: false, targetRoute: '/login', error: 'Full name is required.' };
    }
    if (!email || !email.includes('@')) {
      return { success: false, targetRoute: '/login', error: 'Enter a valid work email address.' };
    }
    if (password.length < 6) {
      return { success: false, targetRoute: '/login', error: 'Password must be at least 6 characters long.' };
    }
    if (!credentials.role) {
      return { success: false, targetRoute: '/login', error: 'Select a role before creating the account.' };
    }
    if (!credentials.team) {
      return { success: false, targetRoute: '/login', error: 'Select a Company / Team.' };
    }

    // Prevent Customer role in internal signup
    if (credentials.role.toLowerCase() === 'customer') {
      return {
        success: false,
        targetRoute: '/login',
        error: 'Customer accounts cannot be registered through the internal workspace.',
      };
    }

    const state = dealStore.getState();
    const existing = state.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      return {
        success: false,
        targetRoute: '/login',
        error: 'An account with this work email already exists. Please log in.',
      };
    }

    const newUser: User = {
      id: `USR-${Date.now()}`,
      name,
      email,
      role: credentials.role,
      title: `${credentials.team} Member`,
      department: credentials.team,
      active: true,
    };

    dealStore.setState((prev) => ({
      users: [...prev.users, newUser],
    }));

    dealStore.loginUser(newUser, credentials.team);

    return {
      success: true,
      user: newUser,
      targetRoute: '/dashboard',
    };
  }

  /**
   * Log out currently active user session
   */
  public logout(): void {
    dealStore.logoutUser();
  }

  /**
   * Quick demo account login helper
   */
  public quickLoginByRole(role: UserRole, specificEmailOrId?: string): AuthResult {
    const normalized = role.toLowerCase().replace('_', '');
    const user = specificEmailOrId
      ? dealStore.getState().users.find((u) => u.email === specificEmailOrId || u.id === specificEmailOrId) ||
        dealStore.getState().users.find((u) => u.role.toLowerCase().replace('_', '') === normalized) ||
        dealStore.getState().users[0]
      : dealStore.getState().users.find((u) => u.role.toLowerCase().replace('_', '') === normalized) ||
        dealStore.getState().users[0];

    dealStore.loginUser(user, 'Enterprise Accounts');
    const targetRoute = user.role.toLowerCase() === 'customer' ? '/portal/quotation' : '/dashboard';

    return {
      success: true,
      user,
      targetRoute,
    };
  }

  public getCurrentUser(): User {
    return dealStore.getState().currentUser;
  }

  public isAuthenticated(): boolean {
    return dealStore.getState().isAuthenticated;
  }
}

export const authService = new AuthService();
