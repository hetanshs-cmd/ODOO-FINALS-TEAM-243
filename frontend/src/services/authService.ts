/**
 * DealFlow360 — Authentication Service
 * Talks to the real backend: POST /auth/login, POST /auth/signup (staff),
 * POST /portal/request-link + POST /portal/verify-link (customer portal
 * magic-link flow). See docs/architecture notes in backend/src/modules/auth.
 */

import { User, UserRole } from '../types';
import { httpClient, ApiError } from './httpClient';
import { tokenStore } from './tokenStore';
import { decodeJwt } from '../utils/jwt';

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

// Dev-only demo credentials seeded by backend/scripts/seed.js. Used only by
// the "Quick Demo Account" buttons on the login screen — never a substitute
// for the real login/signup flow.
const DEMO_ROLE_EMAILS: Partial<Record<string, string>> = {
  admin: 'admin@dev.local',
  sales_rep: 'rep@dev.local',
  sales_manager: 'manager@dev.local',
  customer: 'portal@dev.local',
};
const DEMO_PASSWORD = 'DevPassword123!';

interface InternalLoginResponse {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
}

interface PortalVerifyResponse {
  accessToken: string;
  user: { id: string; name: string; email: string };
  customerId: string;
}

interface PortalRequestLinkResponse {
  message: string;
  devToken?: string;
}

function targetRouteForRole(role: string): string {
  return role.toUpperCase() === 'CUSTOMER' ? '/portal/quotation' : '/dashboard';
}

function toUser(raw: { id: string; name: string; email: string; role?: string }, customerId?: string): User {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: (raw.role || 'CUSTOMER') as UserRole,
    active: true,
    customerId,
  };
}

class AuthService {
  /**
   * Internal staff login. Customer-portal login does NOT go through this
   * method on the real backend — it's the two-step magic-link flow below
   * (requestPortalLink / verifyPortalLink). `isCustomerPortal` is kept on
   * the credentials shape for backward compatibility with existing call
   * sites, but is rejected here with guidance to use the magic-link flow.
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    if (credentials.isCustomerPortal) {
      return {
        success: false,
        targetRoute: '/login',
        error: 'Customer portal sign-in uses a secure access link. Request one below.',
      };
    }

    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password || '';

    if (!email) {
      return { success: false, targetRoute: '/login', error: 'Enter a valid email address.' };
    }
    if (!password) {
      return { success: false, targetRoute: '/login', error: 'Password is required.' };
    }

    try {
      const result = await httpClient.post<InternalLoginResponse>('/auth/login', { email, password });
      tokenStore.setToken(result.accessToken);
      const user = toUser(result.user);
      return { success: true, user, targetRoute: targetRouteForRole(user.role) };
    } catch (err) {
      return {
        success: false,
        targetRoute: '/login',
        error: err instanceof ApiError ? err.message : 'Unable to sign in. Please retry.',
      };
    }
  }

  /**
   * Internal staff registration. NOTE: POST /auth/signup is being added by
   * a teammate on the `backend` branch concurrently and may not exist yet —
   * this call is shaped correctly per the documented contract (mirrors
   * /auth/login's response: { accessToken, user }) and will 404 until that
   * branch is merged. That's expected; it is not a bug in this wiring.
   */
  public async signup(credentials: SignupCredentials): Promise<AuthResult> {
    const email = credentials.email.trim().toLowerCase();
    const name = credentials.name.trim();
    const password = credentials.password;

    if (!name) {
      return { success: false, targetRoute: '/login', error: 'Full name is required.' };
    }
    if (!email || !email.includes('@')) {
      return { success: false, targetRoute: '/login', error: 'Enter a valid work email address.' };
    }
    if (password.length < 8) {
      return { success: false, targetRoute: '/login', error: 'Password must be at least 8 characters long.' };
    }
    if (!credentials.role) {
      return { success: false, targetRoute: '/login', error: 'Select a role before creating the account.' };
    }
    if (credentials.role.toString().toUpperCase() === 'CUSTOMER') {
      return {
        success: false,
        targetRoute: '/login',
        error: 'Customer accounts cannot be registered through the internal workspace.',
      };
    }
    if (!credentials.team) {
      return { success: false, targetRoute: '/login', error: 'Select a Company / Team.' };
    }

    try {
      const result = await httpClient.post<InternalLoginResponse>('/auth/signup', {
        name,
        email,
        password,
        role: 'SALES_REP',
      });
      tokenStore.setToken(result.accessToken);
      const user = toUser(result.user);
      return { success: true, user, targetRoute: targetRouteForRole(user.role) };
    } catch (err) {
      return {
        success: false,
        targetRoute: '/login',
        error:
          err instanceof ApiError
            ? err.isNotFound
              ? 'Sign-up is not yet available on this backend deployment.'
              : err.message
            : 'Failed to register account. Please retry.',
      };
    }
  }

  /**
   * Step 1 of the customer portal magic-link flow: POST /portal/request-link.
   * Always resolves successfully from the backend's point of view (it never
   * reveals whether the email is registered), but the response may carry a
   * `devToken` outside production so the flow is testable without a real
   * inbox — surfaced here so the UI can offer a "paste your link token" step.
   */
  public async requestPortalLink(email: string): Promise<{ message: string; devToken?: string }> {
    const result = await httpClient.post<PortalRequestLinkResponse>('/portal/request-link', {
      email: email.trim().toLowerCase(),
    });
    return result;
  }

  /**
   * Step 2 of the customer portal magic-link flow: POST /portal/verify-link.
   */
  public async verifyPortalLink(token: string): Promise<AuthResult> {
    try {
      const result = await httpClient.post<PortalVerifyResponse>('/portal/verify-link', { token });
      tokenStore.setToken(result.accessToken);
      const user = toUser({ ...result.user, role: 'CUSTOMER' }, result.customerId);
      return { success: true, user, targetRoute: '/portal/quotation' };
    } catch (err) {
      return {
        success: false,
        targetRoute: '/login',
        error: err instanceof ApiError ? err.message : 'This link is invalid or has expired.',
      };
    }
  }

  /**
   * Log out: clear the stored token. Any cached user state in useAuth is
   * cleared by the hook itself.
   */
  public logout(): void {
    tokenStore.clearToken();
  }

  /**
   * Quick demo account login helper — dev convenience only, backed by the
   * fixed accounts seeded in backend/scripts/seed.js (DevPassword123!).
   * Internal roles without a seeded account (FINANCE, OPERATIONS) resolve
   * to a clean error rather than a silent stub.
   */
  public async quickLoginByRole(role: UserRole, specificEmailOrId?: string): Promise<AuthResult> {
    const normalized = role.toString().toLowerCase().replace(/_/g, '');
    const isCustomer = normalized === 'customer';

    if (isCustomer) {
      // Demo customers don't have a real backend account distinct from the
      // one seeded portal user — route through the magic-link flow using
      // the seeded portal email so the demo still exercises the real API.
      const email = DEMO_ROLE_EMAILS.customer!;
      const linkResult = await this.requestPortalLink(email);
      if (!linkResult.devToken) {
        return {
          success: false,
          targetRoute: '/login',
          error: 'Demo customer login requires a dev backend (no devToken returned).',
        };
      }
      return this.verifyPortalLink(linkResult.devToken);
    }

    const demoKey = Object.keys(DEMO_ROLE_EMAILS).find(
      (key) => key.replace(/_/g, '') === normalized
    );
    const email = demoKey ? DEMO_ROLE_EMAILS[demoKey] : undefined;
    if (!email) {
      return {
        success: false,
        targetRoute: '/login',
        error: `No seeded demo account exists for role "${role}" yet.`,
      };
    }

    return this.login({ email, password: DEMO_PASSWORD, isCustomerPortal: false });
  }

  public getStoredToken(): string | null {
    return tokenStore.getToken();
  }

  public decodeStoredUser(): { id: string; role?: string; customerId?: string } | null {
    const token = tokenStore.getToken();
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload) return null;
    return { id: payload.sub, role: payload.role as string | undefined, customerId: payload.customerId as string | undefined };
  }
}

export const authService = new AuthService();
