/**
 * JWT Utilities
 *
 * One place for signing/verifying both kinds of token this app issues:
 *   - "internal" — staff login (POST /auth/login)
 *   - "portal"   — customer portal login (POST /portal/verify-link)
 *
 * They share one JWT_SECRET for simplicity (this is a hackathon-scale app,
 * not a multi-tenant SaaS with independent key rotation needs). The `scope`
 * claim is what keeps them from being interchangeable — see auth.middleware.ts,
 * which rejects a token with the wrong scope.
 *
 * Nothing outside this file should call `jwt.sign`/`jwt.verify` directly.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { InternalJwtPayload, PortalJwtPayload } from '../modules/auth/auth.types';

export function signInternalToken(userId: string, role: string): string {
  const payload: InternalJwtPayload = { sub: userId, role, scope: 'internal' };
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyInternalToken(token: string): InternalJwtPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as InternalJwtPayload;
  if (payload.scope !== 'internal') {
    throw new Error('Not an internal token');
  }
  return payload;
}

export function signPortalToken(userId: string, customerId: string): string {
  const payload: PortalJwtPayload = { sub: userId, customerId, scope: 'portal' };
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyPortalToken(token: string): PortalJwtPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as PortalJwtPayload;
  if (payload.scope !== 'portal') {
    throw new Error('Not a portal token');
  }
  return payload;
}
