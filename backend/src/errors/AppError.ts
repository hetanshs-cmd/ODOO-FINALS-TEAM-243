/**
 * AppError — Typed application error.
 *
 * Use this to throw structured errors throughout the application.
 * The global error handler middleware catches these and formats
 * them as safe, structured JSON responses.
 *
 * Example usage:
 *   throw new AppError('USER_NOT_FOUND', 404, 'User does not exist');
 *   throw new AppError('VALIDATION_ERROR', 400, 'Invalid input', details);
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown[];
  public readonly isOperational: boolean;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: unknown[]
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguish from programming errors

    // Capture stack trace (Node.js only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Common error factory functions.
 * Use these for consistency across the application.
 */
export const Errors = {
  notFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', 404, `${resource} not found`),

  unauthorized: () =>
    new AppError('UNAUTHORIZED', 401, 'Authentication required'),

  forbidden: () =>
    new AppError('FORBIDDEN', 403, 'Insufficient permissions'),

  conflict: (message = 'Resource already exists') =>
    new AppError('CONFLICT', 409, message),

  validationError: (details: unknown[]) =>
    new AppError('VALIDATION_ERROR', 400, 'Request validation failed', details),

  businessRuleViolation: (message: string) =>
    new AppError('BUSINESS_RULE_VIOLATION', 422, message),

  internalError: () =>
    new AppError('INTERNAL_SERVER_ERROR', 500, 'An unexpected error occurred'),
} as const;
