/**
 * Pagination Utility
 *
 * Use for all list endpoints to ensure consistent pagination.
 *
 * Usage in Controller:
 *   const pagination = getPaginationParams(req.query);
 *   const result = await someService.list(pagination);
 *
 * Usage in Repository:
 *   db.query(
 *     'SELECT ... FROM ... LIMIT $1 OFFSET $2',
 *     [pagination.limit, pagination.offset]
 *   );
 */

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function getPaginationParams(query: { page?: unknown; limit?: unknown }): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
