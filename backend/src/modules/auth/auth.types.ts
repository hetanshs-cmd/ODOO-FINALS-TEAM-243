/**
 * Auth Module Types
 *
 * Shapes shared across the auth service/controller/middleware.
 * Kept minimal on purpose — the JWT payloads only carry what's needed
 * to authenticate and authorize a request, nothing sensitive.
 */

// What we put inside an internal (staff) JWT.
export interface InternalJwtPayload {
  sub: string; // users.id
  role: string; // roles.name, e.g. "SALES_REP"
  scope: 'internal';
}

// What we put inside a customer portal JWT.
export interface PortalJwtPayload {
  sub: string; // users.id
  customerId: string; // customers.id this portal user belongs to
  scope: 'portal';
}

// req.user, set by the `authenticate` middleware.
export interface AuthenticatedUser {
  id: string;
  role: string;
}

// req.portalUser, set by the `authenticatePortal` middleware.
export interface AuthenticatedPortalUser {
  id: string;
  customerId: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface RequestMagicLinkResult {
  message: string;
  // Only present outside production, so the link can be tested without
  // a real email service. See auth.service.ts for details.
  devToken?: string;
}

export interface VerifyMagicLinkResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  customerId: string;
}
