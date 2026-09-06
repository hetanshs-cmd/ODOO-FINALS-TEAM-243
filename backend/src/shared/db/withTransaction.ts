import { PoolClient } from 'pg';
import { db } from '../../config/database';

/**
 * Runs `fn` inside a single Postgres transaction on a dedicated client.
 *
 * Use for any multi-statement write sequence where a partial failure must
 * not leave the DB in an inconsistent state — e.g. the discount engine's
 * check → discount_evaluations insert → quotation status update →
 * approval_requests creation chain (docs/references.md: Medusa Workflows —
 * model multi-step operations so a failed step rolls back cleanly). A full
 * workflow engine with per-step compensation is overkill for this codebase's
 * scale; a DB transaction gives the same all-or-nothing guarantee for a
 * sequence that lives entirely inside one request.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
