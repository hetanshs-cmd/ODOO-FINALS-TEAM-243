import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Notification } from './notifications.model';

export const notificationsRepository = {
  async insert(
    client: PoolClient,
    input: {
      userId: string;
      type: string;
      title: string;
      message: string;
      referenceType?: string | null;
      referenceId?: string | null;
    },
  ): Promise<Notification> {
    const { rows } = await client.query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        input.userId,
        input.type,
        input.title,
        input.message,
        input.referenceType ?? null,
        input.referenceId ?? null,
      ],
    );
    return rows[0] as Notification;
  },

  async listForUser(userId: string, limit: number, offset: number): Promise<Notification[]> {
    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    );
    return rows as Notification[];
  },

  async countForUser(userId: string): Promise<number> {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1',
      [userId],
    );
    return (rows[0] as { count: number }).count;
  },

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const { rows } = await db.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return (rows[0] as Notification | undefined) ?? null;
  },
};
