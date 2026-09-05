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

export interface CustomerLinkRow {
  customer_id: string;
}

/**
 * Finds the customer this user is linked to as a portal user, via
 * `customer_users`. A user could in theory be linked to more than one
 * customer (no DB constraint prevents it) — for this stub phase we just
 * use the first active link. Supporting multiple customers per portal
 * user is a future enhancement, not needed yet.
 */
export async function findActiveCustomerLink(userId: string): Promise<CustomerLinkRow | null> {
  const result = await db.query<CustomerLinkRow>(
    `SELECT cu.customer_id
     FROM customer_users cu
     JOIN customers c ON c.id = cu.customer_id
     WHERE cu.user_id = $1 AND cu.status = 'ACTIVE' AND c.status = 'ACTIVE'
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}
