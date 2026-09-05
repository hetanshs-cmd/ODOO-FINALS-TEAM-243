import { db } from '../../config/database';
import { Errors } from '../../errors/AppError';
import { getPaginationParams, buildPaginatedResult, PaginationParams, PaginatedResult } from '../../utils/pagination';
import { CrudRepository } from './crudRepository';
import { mapDbError } from './dbErrors';

export interface CrudServiceConfig {
  /** Human-readable resource name for error messages, e.g. "Discount rule". */
  resourceName: string;
  /** audit_logs.entity_type value for this resource, e.g. "discount_rule". */
  entityType: string;
}

export interface CrudService<T> {
  list(query: { page?: unknown; limit?: unknown }): Promise<PaginatedResult<T>>;
  getById(id: string): Promise<T>;
  create(data: Record<string, unknown>, actorId: string | null): Promise<T>;
  update(id: string, data: Record<string, unknown>, actorId: string | null): Promise<T>;
  remove(id: string, actorId: string | null): Promise<void>;
}

/**
 * Generic Service Factory
 *
 * Wraps a CrudRepository with resource-agnostic business logic: not-found
 * handling, DB constraint error translation, and audit logging.
 *
 * Every admin write is recorded in `audit_logs` (docs/architecture.md: "every
 * admin write goes through the audit log"). `actorId` is nullable because the
 * `auth` module (JWT/req.user) has not landed yet — audit_logs.user_id is
 * nullable for exactly this reason. Once auth exists, pass req.user.id
 * through the controller instead of null.
 */
export function createCrudService<T extends { id: string }>(
  repository: CrudRepository<T>,
  config: CrudServiceConfig
): CrudService<T> {
  const { resourceName, entityType } = config;

  async function writeAuditLog(
    action: 'CREATED' | 'UPDATED' | 'DELETED',
    entityId: string,
    actorId: string | null,
    oldValue: unknown,
    newValue: unknown
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        action,
        entityType,
        entityId,
        oldValue !== undefined ? JSON.stringify(oldValue) : null,
        newValue !== undefined ? JSON.stringify(newValue) : null,
      ]
    );
  }

  return {
    async list(query): Promise<PaginatedResult<T>> {
      const pagination: PaginationParams = getPaginationParams(query);
      const [items, total] = await Promise.all([
        repository.list(pagination.limit, pagination.offset),
        repository.count(),
      ]);
      return buildPaginatedResult(items, total, pagination);
    },

    async getById(id): Promise<T> {
      const item = await repository.findById(id);
      if (!item) throw Errors.notFound(resourceName);
      return item;
    },

    async create(data, actorId): Promise<T> {
      try {
        const created = await repository.create(data);
        await writeAuditLog('CREATED', created.id, actorId, undefined, created);
        return created;
      } catch (err) {
        throw mapDbError(err, resourceName);
      }
    },

    async update(id, data, actorId): Promise<T> {
      const before = await repository.findById(id);
      if (!before) throw Errors.notFound(resourceName);

      try {
        const updated = await repository.update(id, data);
        if (!updated) throw Errors.notFound(resourceName);
        await writeAuditLog('UPDATED', id, actorId, before, updated);
        return updated;
      } catch (err) {
        throw mapDbError(err, resourceName);
      }
    },

    async remove(id, actorId): Promise<void> {
      const before = await repository.findById(id);
      if (!before) throw Errors.notFound(resourceName);

      try {
        const deleted = await repository.remove(id);
        if (!deleted) throw Errors.notFound(resourceName);
        await writeAuditLog('DELETED', id, actorId, before, undefined);
      } catch (err) {
        throw mapDbError(err, resourceName);
      }
    },
  };
}
