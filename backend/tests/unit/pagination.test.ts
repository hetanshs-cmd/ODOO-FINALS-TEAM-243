import { describe, it, expect } from 'vitest';
import { getPaginationParams, buildPaginatedResult } from '../../src/utils/pagination';

describe('getPaginationParams', () => {
  it('should return defaults when no query params given', () => {
    const result = getPaginationParams({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should parse page and limit from query', () => {
    const result = getPaginationParams({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it('should cap limit at 100', () => {
    const result = getPaginationParams({ limit: '999' });
    expect(result.limit).toBe(100);
  });

  it('should floor page to 1 for invalid values', () => {
    const result = getPaginationParams({ page: '-5' });
    expect(result.page).toBe(1);
  });
});

describe('buildPaginatedResult', () => {
  it('should build correct pagination metadata', () => {
    const items = [1, 2, 3];
    const result = buildPaginatedResult(items, 100, { page: 2, limit: 10, offset: 10 });
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(10);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.items).toHaveLength(3);
  });
});
