import { describe, it, expect, vi, beforeEach } from 'vitest';
import { creditNotesRepository } from './credit-notes.repository';
import { creditNotesService } from './credit-notes.service';
import { CreditNote } from './credit-notes.model';

vi.mock('./credit-notes.repository');

function makeCreditNote(overrides: Partial<CreditNote> = {}): CreditNote {
  return {
    id: 'cn-1',
    subscription_id: 'sub-1',
    customer_id: 'customer-1',
    amount: '50.00',
    reason: 'Prorated refund',
    status: 'PENDING',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('creditNotesService.updateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown credit note', async () => {
    vi.mocked(creditNotesRepository.findById).mockResolvedValue(null);

    await expect(creditNotesService.updateStatus('missing', 'APPLIED')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects transitioning an already-resolved credit note', async () => {
    vi.mocked(creditNotesRepository.findById).mockResolvedValue(
      makeCreditNote({ status: 'APPLIED' }),
    );

    await expect(creditNotesService.updateStatus('cn-1', 'VOIDED')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('applies a valid PENDING -> APPLIED transition', async () => {
    vi.mocked(creditNotesRepository.findById).mockResolvedValue(makeCreditNote());
    vi.mocked(creditNotesRepository.updateStatus).mockResolvedValue(
      makeCreditNote({ status: 'APPLIED' }),
    );

    const result = await creditNotesService.updateStatus('cn-1', 'APPLIED');

    expect(result.status).toBe('APPLIED');
  });
});
