import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customersRepository } from './customers.repository';
import { customersService } from './customers.service';

vi.mock('./customers.repository');

describe('customersService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a paginated result built from the repository', async () => {
    vi.mocked(customersRepository.list).mockResolvedValue([
      { id: 'c1', company_name: 'Acme', customer_tier_id: 'tier-1', status: 'ACTIVE' },
    ]);
    vi.mocked(customersRepository.count).mockResolvedValue(1);

    const result = await customersService.list({});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(customersRepository.list).toHaveBeenCalledWith(20, 0);
  });
});
