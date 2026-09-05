import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { getPaginationParams, buildPaginatedResult } from '../../utils/pagination';
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
    const pagination = getPaginationParams(query);
    const [items, total] = await Promise.all([
      notificationsRepository.listForUser(userId, pagination.limit, pagination.offset),
      notificationsRepository.countForUser(userId),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async markRead(id: string, userId: string) {
    const updated = await notificationsRepository.markRead(id, userId);
    if (!updated) throw Errors.notFound('Notification');
    return updated;
  },
};
