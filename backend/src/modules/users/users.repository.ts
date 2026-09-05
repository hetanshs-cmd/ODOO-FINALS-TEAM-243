import { db } from '../../config/database';

export interface UserDirectoryRow {
  id: string;
  name: string;
  role: string;
}

export const usersRepository = {
  /** id/name/role only — no email or other sensitive fields. */
  async list(): Promise<UserDirectoryRow[]> {
    const { rows } = await db.query(
      `SELECT u.id, u.name, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'ACTIVE'
       ORDER BY u.name ASC`,
    );
    return rows as UserDirectoryRow[];
  },
};
