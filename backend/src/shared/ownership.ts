import { Errors } from '../errors/AppError';
import { AuthenticatedUser } from '../modules/auth/auth.types';

/**
 * Row-level scope check for internal callers acting on a quotation-derived
 * resource (the quotation itself, its negotiations, its conversion, etc.).
 *
 * A plain SALES_REP may only act on quotations they own; SALES_MANAGER,
 * OPERATIONS and ADMIN act on any. Mirrors
 * quotations.service.assertCanAccessQuotation so every mutation path that
 * branches off a quotation enforces the same rule instead of relying on the
 * route's role guard alone (which never checks ownership).
 *
 * Portal callers are handled separately (customerId tenant isolation) and
 * must not be passed here.
 */
export function assertInternalCanAccessQuotationOwner(
  ownerSalesRepId: string,
  requester: AuthenticatedUser,
): void {
  if (requester.role === 'SALES_REP' && ownerSalesRepId !== requester.id) {
    throw Errors.forbidden();
  }
}
