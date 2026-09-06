import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';
import { CrudService } from './crudService';

export interface CrudController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next: NextFunction): Promise<void>;
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  remove(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Generic Controller Factory
 *
 * Parses the request, calls the Service, formats the response — nothing
 * resource-specific lives here. Every admin route runs `authenticate` first
 * (admin.routes.ts), so `req.user` is always set for these controllers in
 * practice; the fallback to null only matters if this factory is ever reused
 * for an unauthenticated route.
 */
export function createCrudController<T>(
  service: CrudService<T>,
  resourceName: string,
): CrudController {
  function actorId(req: Request): string | null {
    return (req as { user?: { id: string } }).user?.id ?? null;
  }

  return {
    async list(req, res, next) {
      try {
        const result = await service.list(req.query);
        sendSuccess({
          res,
          data: result,
          message: `${resourceName} list retrieved successfully`,
        });
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const item = await service.getById(req.params['id'] as string);
        sendSuccess({ res, data: item, message: `${resourceName} retrieved successfully` });
      } catch (err) {
        next(err);
      }
    },

    async create(req, res, next) {
      try {
        const created = await service.create(req.body, actorId(req));
        sendCreated({ res, data: created, message: `${resourceName} created successfully` });
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const updated = await service.update(req.params['id'] as string, req.body, actorId(req));
        sendSuccess({ res, data: updated, message: `${resourceName} updated successfully` });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await service.remove(req.params['id'] as string, actorId(req));
        sendNoContent(res);
      } catch (err) {
        next(err);
      }
    },
  };
}
