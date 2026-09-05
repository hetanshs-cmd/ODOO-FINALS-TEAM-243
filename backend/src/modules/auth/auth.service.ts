/**
 * Auth Service
 *
 * All auth business logic lives here — the controller only parses
 * requests and formats responses, it never touches bcrypt/JWT/SQL directly.
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AppError } from '../../errors/AppError';
import { config } from '../../config/env';
import { signInternalToken, signPortalToken } from '../../utils/jwt';
import * as authRepository from './auth.repository';
import { LoginResult, RequestMagicLinkResult, VerifyMagicLinkResult } from './auth.types';

/**
 * POST /auth/login
 *
 * On failure we always throw the same generic "invalid credentials" error,
 * whether the email doesn't exist, the account is inactive, or the password
 * is wrong. This stops an attacker from using the error message to figure
 * out which emails are registered.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const invalidCredentials = () =>
    new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');

  const user = await authRepository.findUserByEmail(email);
  if (!user) {
    throw invalidCredentials();
  }
  if (user.status !== 'ACTIVE') {
    throw invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw invalidCredentials();
  }

  await authRepository.updateLastLogin(user.id);

  const accessToken = signInternalToken(user.id, user.role_name);

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_name,
    },
  };
}

/**
 * In-memory magic-link store — STUB for this phase.
 *
 * A real implementation would persist this in a database table (so it
 * survives a server restart / works across multiple backend instances)
 * and email the link instead of logging/returning it. That's tracked as
 * a TODO, not built now — see docs/development-workflow.md, which
 * explicitly calls the portal magic-link out as a stub for this phase.
 */
interface MagicLinkRecord {
  userId: string;
  customerId: string;
  expiresAt: number;
}

const magicLinks = new Map<string, MagicLinkRecord>();
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * POST /portal/request-link
 *
 * Always returns the same generic message, whether or not the email
 * belongs to a real portal user — same reasoning as login: don't let
 * this endpoint be used to discover which emails exist.
 */
export async function requestMagicLink(email: string): Promise<RequestMagicLinkResult> {
  const genericResponse: RequestMagicLinkResult = {
    message: 'If this email is registered for portal access, a login link has been sent.',
  };

  const user = await authRepository.findUserByEmail(email);
  if (!user || user.status !== 'ACTIVE') {
    return genericResponse;
  }

  const customerLink = await authRepository.findActiveCustomerLink(user.id);
  if (!customerLink) {
    return genericResponse;
  }

  const token = crypto.randomBytes(32).toString('hex');
  magicLinks.set(token, {
    userId: user.id,
    customerId: customerLink.customer_id,
    expiresAt: Date.now() + MAGIC_LINK_TTL_MS,
  });

  // STUB: log instead of emailing — there's no email service configured yet.
  console.log(`[portal] magic link for ${email}: token=${token}`);

  return {
    ...genericResponse,
    // Only returned outside production, so the flow is testable end-to-end
    // without a real inbox. Never do this in production.
    devToken: config.NODE_ENV !== 'production' ? token : undefined,
  };
}

/**
 * POST /portal/verify-link
 */
export async function verifyMagicLink(token: string): Promise<VerifyMagicLinkResult> {
  const record = magicLinks.get(token);

  // One-time use — remove it as soon as we look it up, valid or not.
  magicLinks.delete(token);

  if (!record) {
    throw new AppError('INVALID_TOKEN', 401, 'This link is invalid or has already been used');
  }
  if (record.expiresAt < Date.now()) {
    throw new AppError('TOKEN_EXPIRED', 401, 'This link has expired');
  }

  const user = await authRepository.findUserById(record.userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('INVALID_TOKEN', 401, 'This link is no longer valid');
  }

  const accessToken = signPortalToken(user.id, record.customerId);

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    customerId: record.customerId,
  };
}
