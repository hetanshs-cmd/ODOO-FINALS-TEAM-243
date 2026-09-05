import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { customersRepository, CustomerListRow } from './customers.repository';

export const customersService = {
  /**
   * Read-only directory for the sales org (id/company_name/tier/status
   * only) — distinct from the ADMIN-only /admin/customers CRUD, which is
   * unchanged and stays the place to create/edit customers.
   */
  async list(query: { page?: unknown; limit?: unknown }): Promise<PaginatedResult<CustomerListRow>> {
    const pagination = getPaginationParams(query);
    const [items, total] = await Promise.all([
      customersRepository.list(pagination.limit, pagination.offset),
      customersRepository.count(),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },
};
