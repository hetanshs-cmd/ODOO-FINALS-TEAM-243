import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { notificationsRepository } from './notifications.repository';

export const notificationsService = {
  /**
   * Fire-and-forget from the caller's point of view — runs in its own
   * transaction rather than the caller's, so a notification failure never
   * rolls back the business operation that triggered it (e.g. a counter-
   * offer being recorded, or a backorder being created).
   */
  async notify(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    referenceType?: string;
    referenceId?: string;
  }): Promise<void> {
    await withTransaction((client) => notificationsRepository.insert(client, input));
  },

  async list(userId: string, query: { page?: unknown; limit?: unknown }) {
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      notificationsRepository.listForUser(userId, limit, offset),
      notificationsRepository.countForUser(userId),
    ]);
    return { items, total, page, limit };
  },

  async markRead(id: string, userId: string) {
    const updated = await notificationsRepository.markRead(id, userId);
    if (!updated) throw Errors.notFound('Notification');
    return updated;
  },
};
