/**
 * Authorization Middleware
 *
 * Two reusable guards, both meant to run AFTER the auth middleware:
 *
 *   requireRole(...roles)     — after `authenticate`, restricts a route
 *                                to specific internal roles (e.g. ADMIN).
 *   requireOwnCustomer(param) — after `authenticatePortal`, restricts a
 *                                route to the customer the portal user
 *                                belongs to (tenant isolation).
 *
 * Future modules should use these instead of writing their own
 * `if (req.user.role !== 'ADMIN')` checks in controllers.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}

/**
 * Compares the customer id in the route (e.g. `/portal/customers/:customerId/...`)
 * against the customer id on the authenticated portal user's token.
 *
 * This is the pattern future customer-scoped routes (quotations, orders,
 * invoices) should follow: look up the resource's owning customer_id,
 * then check it against req.portalUser.customerId the same way — never
 * trust a client-supplied customer id on its own.
 */
export function requireOwnCustomer(customerIdParam: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.portalUser) {
      next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
      return;
    }
    const requestedCustomerId = req.params[customerIdParam];
    if (requestedCustomerId !== req.portalUser.customerId) {
      next(new AppError('FORBIDDEN', 403, 'You do not have access to this customer'));
      return;
    }
    next();
  };
}
