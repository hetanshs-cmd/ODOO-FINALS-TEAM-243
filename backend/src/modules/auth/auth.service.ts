/**
 * Auth Service
 *
 * All auth business logic lives here — the controller only parses
 * requests and formats responses, it never touches bcrypt/JWT/SQL directly.
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AppError, Errors } from '../../errors/AppError';
import { mapDbError } from '../../shared/crud/dbErrors';
import { config } from '../../config/env';
import { signInternalToken, signPortalToken } from '../../utils/jwt';
import * as authRepository from './auth.repository';
import { LoginResult, RequestMagicLinkResult, VerifyMagicLinkResult } from './auth.types';

// Least-privileged internal role — applied when a signup request doesn't
// specify one. Staff signup is the only flow this endpoint serves for now;
// CUSTOMER accounts are provisioned via customer_users/admin, not self-signup.
const DEFAULT_SIGNUP_ROLE = 'SALES_REP';

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
  if (user.status !== 'ACTIVE' || user.role_name === 'CUSTOMER') {
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
 * POST /auth/signup
 *
 * Creates a new internal (staff) user and logs them in immediately,
 * returning the exact same { accessToken, user } shape as login() — so a
 * client can treat signup and login responses identically.
 */
export async function signup(input: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<LoginResult> {
  if (input.role && input.role !== DEFAULT_SIGNUP_ROLE) {
    throw new AppError('FORBIDDEN', 403, 'Public registration only permits the Sales Rep role');
  }
  const existing = await authRepository.findUserByEmail(input.email);
  if (existing) {
    throw Errors.conflict('An account with this email already exists');
  }

  const roleName = input.role ?? DEFAULT_SIGNUP_ROLE;
  const role = await authRepository.findRoleByName(roleName);
  if (!role) {
    throw new AppError('INVALID_ROLE', 400, `Role "${roleName}" does not exist`);
  }

  const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);

  let user;
  try {
    user = await authRepository.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      roleId: role.id,
    });
  } catch (err) {
    // Catches the race where two signups for the same email land between
    // the pre-check above and this insert — the UNIQUE constraint on
    // users.email is the real guard, this just gives it a clean 409.
    throw mapDbError(err, 'User');
  }

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

  // Delivery is not configured. Never put a bearer credential in server logs.

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
