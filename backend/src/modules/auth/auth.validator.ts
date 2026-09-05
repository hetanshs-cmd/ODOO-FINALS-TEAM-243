import { z } from 'zod';

/**
 * POST /auth/login
 */
export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
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
