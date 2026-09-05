import { AppError, Errors } from '../../errors/AppError';

/**
 * Maps raw PostgreSQL error codes to safe, structured AppErrors.
 *
 * Rationale: constraint violations (unique/FK/check) are business-meaningful
 * outcomes, not server failures — they must surface as 409/422, not bubble up
 * to the generic 500 handler which would also leak the raw DB error message.
 *
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
interface PgError {
  code?: string;
  detail?: string;
  constraint?: string;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

export function mapDbError(err: unknown, resourceName: string): AppError {
  const pgErr = err as PgError;

  switch (pgErr.code) {
    case UNIQUE_VIOLATION:
      return Errors.conflict(
        `${resourceName} with the same unique value already exists`
      );
    case FOREIGN_KEY_VIOLATION:
      return new AppError(
        'BUSINESS_RULE_VIOLATION',
        422,
        `${resourceName} references a record that does not exist, or is still referenced by another record`
      );
    case CHECK_VIOLATION:
      return new AppError(
        'VALIDATION_ERROR',
        400,
        `${resourceName} violates a database constraint${pgErr.constraint ? ` (${pgErr.constraint})` : ''}`
      );
    case NOT_NULL_VIOLATION:
      return new AppError('VALIDATION_ERROR', 400, `${resourceName} is missing a required field`);
    default:
      throw err instanceof Error ? err : new Error(String(err));
  }
}
