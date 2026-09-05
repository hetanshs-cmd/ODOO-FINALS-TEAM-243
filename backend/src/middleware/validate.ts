import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from '../errors/AppError';

/**
 * Validation Middleware Factory
 *
 * Creates middleware that validates request body, params, or query
 * against a Zod schema. Throws a structured validation error if
 * validation fails.
 *
 * Usage:
 *   router.post(
 *     '/users',
 *     validate({ body: createUserSchema }),
 *     usersController.createUser
 *   );
 */
export function validate(schemas: { body?: ZodSchema; params?: ZodSchema; query?: ZodSchema }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError('VALIDATION_ERROR', 400, 'Request validation failed', details));
      } else {
        next(err);
      }
    }
  };
}
