/**
 * Authentication Middleware
 *
 * Verifies the JWT on protected routes and attaches the authenticated
 * user to the request. Two flavors, matching the two token types this
 * app issues (see src/utils/jwt.ts):
 *
 *   authenticate       — internal staff routes, sets req.user
 *   authenticatePortal — customer portal routes, sets req.portalUser
 *
 * Neither one queries the database — they trust the JWT's claims for
 * the token's lifetime (a few minutes). This keeps every protected
 * request to a single, fast step instead of a DB round trip per request.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { verifyInternalToken, verifyPortalToken } from '../utils/jwt';
import { AuthenticatedPortalUser, AuthenticatedUser } from '../modules/auth/auth.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      portalUser?: AuthenticatedPortalUser;
    }
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    return;
  }

  try {
    const payload = verifyInternalToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError('UNAUTHORIZED', 401, 'Invalid or expired token'));
  }
}

export function authenticatePortal(req: Request, _res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    return;
  }

  try {
    const payload = verifyPortalToken(token);
    req.portalUser = { id: payload.sub, customerId: payload.customerId };
    next();
  } catch {
    next(new AppError('UNAUTHORIZED', 401, 'Invalid or expired token'));
  }
}
