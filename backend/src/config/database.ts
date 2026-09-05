import { Pool } from 'pg';
import { config } from './env';

/**
 * PostgreSQL connection pool.
 *
 * Uses a pool (not single connection) for:
 * - Connection reuse across requests
 * - Concurrency safety
 * - Connection limit management
 *
 * All queries must use parameterized form:
 *   db.query('SELECT id FROM users WHERE email = $1', [email])
 *
 * NEVER interpolate user input into SQL strings.
 */
export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,              // Maximum connections in pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Log when a client is checked out or checked back in (dev only)
if (config.NODE_ENV === 'development') {
  db.on('acquire', () => {
    // Uncomment for verbose pool debugging:
    // console.debug('[DB] Client acquired from pool');
  });
}

db.on('error', (err) => {
  console.error('[DB] Unexpected database error on idle client:', err);
});

export type DatabaseClient = Pool;
