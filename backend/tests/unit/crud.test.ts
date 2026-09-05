import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Generic CRUD Factory — Unit Tests
 *
 * Exercises the shared repository/service factories against a mocked `db`
 * so every admin resource built on top of them (products, discount_rules,
 * warehouses, ...) inherits verified behavior without per-resource tests.
 */

const queryMock = vi.fn();

vi.mock('../../src/config/database', () => ({
  db: { query: (...args: unknown[]) => queryMock(...args) },
}));

import { createCrudRepository } from '../../src/shared/crud/crudRepository';
import { createCrudService } from '../../src/shared/crud/crudService';
import { AppError } from '../../src/errors/AppError';

interface Widget {
  id: string;
  name: string;
  price: string;
}

const COLUMNS = ['name', 'price'] as const;

beforeEach(() => {
  queryMock.mockReset();
});

describe('createCrudRepository', () => {
  it('list() queries with LIMIT/OFFSET and returns rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Widget', price: '9.99' }] });
    const repo = createCrudRepository<Widget>({ table: 'widgets', columns: COLUMNS });

    const rows = await repo.list(20, 0);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM widgets'),
      [20, 0]
    );
    expect(rows).toHaveLength(1);
  });

  it('create() only inserts columns present in the allowlist and in the payload', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: '1', name: 'Widget', price: '9.99' }],
    });
    const repo = createCrudRepository<Widget>({ table: 'widgets', columns: COLUMNS });

    await repo.create({ name: 'Widget', price: '9.99', not_a_column: 'ignored' });

    const [sql, values] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO widgets (name, price)');
    expect(sql).not.toContain('not_a_column');
    expect(values).toEqual(['Widget', '9.99']);
  });

  it('update() sets only the fields provided', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Renamed', price: '9.99' }] });
    const repo = createCrudRepository<Widget>({ table: 'widgets', columns: COLUMNS });

    await repo.update('1', { name: 'Renamed' });

    const [sql, values] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE widgets SET name = $2');
    expect(sql).not.toContain('price');
    expect(values).toEqual(['1', 'Renamed']);
  });

  it('remove() reports success based on rowCount', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    const repo = createCrudRepository<Widget>({ table: 'widgets', columns: COLUMNS });

    expect(await repo.remove('1')).toBe(true);

    queryMock.mockResolvedValueOnce({ rowCount: 0 });
    expect(await repo.remove('missing')).toBe(false);
  });
});

describe('createCrudService', () => {
  function buildService() {
    const repository = createCrudRepository<Widget>({ table: 'widgets', columns: COLUMNS });
    return createCrudService(repository, { resourceName: 'Widget', entityType: 'widget' });
  }

  it('getById() throws a 404 AppError when the row does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // findById
    const service = buildService();

    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    } satisfies Partial<AppError>);
  });

  it('create() writes an audit_logs row after inserting', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Widget', price: '9.99' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // audit_logs INSERT
    const service = buildService();

    await service.create({ name: 'Widget', price: '9.99' }, 'user-1');

    const auditCall = queryMock.mock.calls[1] as [string, unknown[]];
    expect(auditCall[0]).toContain('INSERT INTO audit_logs');
    expect(auditCall[1]).toEqual(
      expect.arrayContaining(['user-1', 'CREATED', 'widget', '1'])
    );
  });

  it('update() throws NOT_FOUND before attempting the write when the row is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // findById (before)
    const service = buildService();

    await expect(service.update('missing', { name: 'X' }, null)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
