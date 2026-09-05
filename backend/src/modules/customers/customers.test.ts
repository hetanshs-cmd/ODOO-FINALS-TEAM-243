import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customersRepository } from './customers.repository';
import { customersService } from './customers.service';

vi.mock('./customers.repository');

describe('customersService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the flat array from the repository (frontend expects ApiCustomer[], not a paginated envelope)', async () => {
    vi.mocked(customersRepository.list).mockResolvedValue([
      {
        id: 'c1',
        name: 'Acme',
        company_name: 'Acme',
        email: null,
        phone: null,
        customer_tier_id: 'tier-1',
        tier: 'GOLD',
        assigned_rep_id: null,
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const result = await customersService.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]?.tier).toBe('GOLD');
    expect(customersRepository.list).toHaveBeenCalledWith();
  });
});
