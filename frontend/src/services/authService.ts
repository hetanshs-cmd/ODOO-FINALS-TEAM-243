/**
 * DealFlow360 — Authentication Service
 * Talks to the real backend: POST /auth/login (staff), POST /auth/signup
 * (staff), POST /portal/login (customer portal, plain email/password). The
 * older POST /portal/request-link + POST /portal/verify-link magic-link
 * flow still exists on the backend but is no longer used by the login form.
 * See docs/architecture notes in backend/src/modules/auth.
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
  finance: 'finance@dev.local',
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
   * Staff login, or customer-portal login when `isCustomerPortal` is set —
   * both are plain email/password against the backend (POST /auth/login or
   * POST /portal/login respectively). The magic-link flow further below
   * (requestPortalLink / verifyPortalLink) still exists but the portal
   * sign-in form no longer uses it.
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password || '';

    if (!email) {
      return { success: false, targetRoute: '/login', error: 'Enter a valid email address.' };
    }
    if (!password) {
      return { success: false, targetRoute: '/login', error: 'Password is required.' };
    }

    if (credentials.isCustomerPortal) {
      return this.portalLogin(email, password);
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
   * Customer portal login: POST /portal/login (email/password, same shape
   * as internal login). Returns a portal-scoped token via signPortalToken.
   */
  public async portalLogin(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await httpClient.post<PortalVerifyResponse>('/portal/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      tokenStore.setToken(result.accessToken);
      const user = toUser({ ...result.user, role: 'CUSTOMER' }, result.customerId);
      return { success: true, user, targetRoute: '/portal/quotation' };
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
      // Each demo customer button passes its own seeded portal email (e.g.
      // Meridian's) — fall back to the default portal account only when
      // none is given, so multiple customer demos stay distinct tenants.
      const email = specificEmailOrId || DEMO_ROLE_EMAILS.customer!;
      return this.portalLogin(email, DEMO_PASSWORD);
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
