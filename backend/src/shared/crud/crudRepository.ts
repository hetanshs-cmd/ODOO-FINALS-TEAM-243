import { db } from '../../config/database';

/**
 * Generic Repository Factory
 *
 * One reusable Repository shape for every simple, single-table admin
 * resource (products, price_lists, discount_rules, warehouses, ...) instead
 * of hand-writing the same five queries per table — see docs/references.md
 * (Strapi: one generic CRUD shape reused across resources).
 *
 * `table` and `columns` are compile-time constants supplied by trusted
 * resource-module code, never derived from request input — so interpolating
 * them into the SQL string is safe (Postgres cannot parameterize identifiers,
 * only values). Every value in a query still goes through a parameterized
 * placeholder — see docs/security.md.
 */
export interface CrudRepositoryConfig {
  /** Table name. Must be a hardcoded, trusted identifier — never user input. */
  table: string;
  /** Insertable/updatable column names, in addition to id/created_at/updated_at. */
  columns: readonly string[];
  /** ORDER BY clause for list(). Must reference a real, trusted column. */
  defaultOrderBy?: string;
}

export interface CrudRepository<T> {
  list(limit: number, offset: number): Promise<T[]>;
  count(): Promise<number>;
  findById(id: string): Promise<T | null>;
  create(data: Record<string, unknown>): Promise<T>;
  update(id: string, data: Record<string, unknown>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
}

export function createCrudRepository<T>(config: CrudRepositoryConfig): CrudRepository<T> {
  const { table, columns, defaultOrderBy = 'created_at DESC' } = config;

  return {
    async list(limit, offset) {
      const { rows } = await db.query(
        `SELECT * FROM ${table} ORDER BY ${defaultOrderBy} LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return rows as T[];
    },

    async count() {
      const { rows } = await db.query(`SELECT COUNT(*) AS count FROM ${table}`);
      return parseInt((rows[0] as { count: string } | undefined)?.count ?? '0', 10);
    },

    async findById(id) {
      const { rows } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return (rows[0] as T | undefined) ?? null;
    },

    async create(data) {
      const keys = columns.filter((col) => data[col] !== undefined);
      const values = keys.map((col) => data[col]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);

      const { rows } = await db.query(
        `INSERT INTO ${table} (${keys.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values,
      );
      const row = rows[0] as T | undefined;
      if (!row) throw new Error(`INSERT into ${table} did not return a row`);
      return row;
    },

    async update(id, data) {
      const keys = columns.filter((col) => data[col] !== undefined);
      if (keys.length === 0) {
        return this.findById(id);
      }

      const setClause = keys.map((col, i) => `${col} = $${i + 2}`).join(', ');
      const values = keys.map((col) => data[col]);

      const { rows } = await db.query(
        `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return (rows[0] as T | undefined) ?? null;
    },

    async remove(id) {
      const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      return (rowCount ?? 0) > 0;
    },
  };
}
