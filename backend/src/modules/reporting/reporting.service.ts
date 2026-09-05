import { getPaginationParams } from '../../utils/pagination';
import { reportingRepository } from './reporting.repository';

export const reportingService = {
  async salesSummary(query: { from?: string; to?: string }) {
    return reportingRepository.salesSummary(query.from, query.to);
  },

  async discountExceptions(query: { page?: unknown; limit?: unknown }) {
    const pagination = getPaginationParams(query);
    const items = await reportingRepository.discountExceptions(pagination.limit, pagination.offset);
    return { items, page: pagination.page, limit: pagination.limit };
  },
};
