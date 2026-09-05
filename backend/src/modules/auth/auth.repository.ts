/**
 * Auth Repository
 *
 * All SQL for the auth module lives here — parameterized queries only.
 * The service layer never talks to `db` directly.
 */
import { db } from '../../config/database';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  status: string;
  role_id: string;
  role_name: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.status, u.role_id, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.status, u.role_id, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
}

export interface RoleRow {
  id: string;
  name: string;
}

export async function findRoleByName(name: string): Promise<RoleRow | null> {
  const result = await db.query<RoleRow>('SELECT id, name FROM roles WHERE name = $1', [name]);
  return result.rows[0] ?? null;
}

/**
 * Creates a new user and returns the same shape as findUserByEmail/findUserById
 * (joined with role name) so the caller can build a LoginResult identically.
 *
 * Relies on the `users.email` UNIQUE constraint (CITEXT, case-insensitive) as
 * the source of truth for duplicate detection — the service does a courtesy
 * pre-check, but this is what actually prevents a race between two concurrent
 * signups for the same email. A unique violation surfaces as a raw pg error
 * (code 23505); the caller maps it via shared/crud/dbErrors.
 */
export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
}): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `WITH inserted AS (
       INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, password_hash, status, role_id
     )
     SELECT inserted.id, inserted.name, inserted.email, inserted.password_hash,
            inserted.status, inserted.role_id, r.name AS role_name
     FROM inserted
     JOIN roles r ON r.id = inserted.role_id`,
    [input.name, input.email, input.passwordHash, input.roleId],
  );
  return result.rows[0] as UserRow;
}

export interface CustomerLinkRow {
  customer_id: string;
}

/**
 * Finds the customer this user is linked to as a portal user, via
 * `users.customer_id` — the 2026-09-05 schema refactor folded the old
 * `customer_users` join table into that single column, one customer per
 * portal user (no DB support for multiple customers per user, same as
 * before this rename).
 */
export async function findActiveCustomerLink(userId: string): Promise<CustomerLinkRow | null> {
  const result = await db.query<CustomerLinkRow>(
    `SELECT u.customer_id
     FROM users u
     JOIN customers c ON c.id = u.customer_id
     WHERE u.id = $1 AND u.customer_id IS NOT NULL AND u.status = 'ACTIVE' AND c.status = 'ACTIVE'
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}
