import { z } from 'zod';

/**
 * POST /auth/login
 */
export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

/**
 * POST /auth/signup
 *
 * `role` is optional and defaults to the least-privileged internal role
 * (SALES_REP) in the service layer — see auth.service.ts's DEFAULT_SIGNUP_ROLE.
 * Restricted to the same set roles.name allows (migrations/003_rbac.sql).
 */
export const signupSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(150),
  email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
  role: z
    .enum(['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'CUSTOMER', 'ADMIN'])
    .optional(),
});

/**
 * POST /portal/request-link
 */
export const portalRequestLinkSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
});

/**
 * POST /portal/verify-link
 */
export const portalVerifyLinkSchema = z.object({
  token: z.string({ required_error: 'Token is required' }).min(1, 'Token is required'),
});
