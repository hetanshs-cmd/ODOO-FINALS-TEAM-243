import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersRepository } from './users.repository';
import { usersService } from './users.service';

vi.mock('./users.repository');

describe('usersService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the id/name/role directory from the repository', async () => {
    vi.mocked(usersRepository.list).mockResolvedValue([
      { id: 'u1', name: 'Jane Doe', role: 'SALES_MANAGER' },
    ]);

    const result = await usersService.list();

    expect(result).toEqual([{ id: 'u1', name: 'Jane Doe', role: 'SALES_MANAGER' }]);
  });
});
