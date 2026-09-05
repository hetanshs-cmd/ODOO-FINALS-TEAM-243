import { Pool, PoolClient } from 'pg';

export interface InsertAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  /** users.id of the actor; null for system-initiated actions (e.g. portal). */
  actorId: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Appends one row to the append-only `audit_logs` table (021_audit_logs.sql
 * blocks UPDATE/DELETE at the DB level). Always call this from inside the
 * same `withTransaction` block as the mutation it records, so the audit
 * entry and the state change it describes commit or roll back together.
 */
export async function insertAuditLog(
  client: PoolClient | Pool,
  input: InsertAuditLogInput,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      input.oldValue !== undefined ? JSON.stringify(input.oldValue) : null,
      input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
    ],
  );
}
