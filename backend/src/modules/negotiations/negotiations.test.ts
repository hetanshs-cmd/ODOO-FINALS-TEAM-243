import { describe, it, expect, vi, beforeEach } from 'vitest';
import { negotiationsRepository } from './negotiations.repository';
import { negotiationsService } from './negotiations.service';

vi.mock('./negotiations.repository');
vi.mock('../discount-engine/discount-engine.service');
vi.mock('../notifications/notifications.service');

describe('negotiationsService.listForQuotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown quotation', async () => {
    vi.mocked(negotiationsRepository.findQuotationForNegotiation).mockResolvedValue(null);

    await expect(negotiationsService.listForQuotation('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('blocks a portal customer from another customer’s quotation', async () => {
    vi.mocked(negotiationsRepository.findQuotationForNegotiation).mockResolvedValue({
      id: 'quote-1',
      status: 'NEGOTIATION',
      sales_rep_id: 'rep-1',
      customer_id: 'customer-1',
    });

    await expect(
      negotiationsService.listForQuotation('quote-1', 'customer-2'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns each negotiation thread with its messages, most-recent first', async () => {
    vi.mocked(negotiationsRepository.findQuotationForNegotiation).mockResolvedValue({
      id: 'quote-1',
      status: 'NEGOTIATION',
      sales_rep_id: 'rep-1',
      customer_id: 'customer-1',
    });
    vi.mocked(negotiationsRepository.listByQuotationId).mockResolvedValue([
      {
        id: 'neg-2',
        quotation_id: 'quote-1',
        initiated_by: 'customer-1',
        status: 'OPEN',
        created_at: '2026-01-02T00:00:00.000Z',
        closed_at: null,
      },
    ]);
    vi.mocked(negotiationsRepository.listMessages).mockResolvedValue([
      {
        id: 'msg-1',
        negotiation_id: 'neg-2',
        sender_user_id: 'customer-1',
        message: 'Can we get a better price?',
        message_type: 'TEXT',
        created_at: '2026-01-02T00:01:00.000Z',
      },
    ]);

    const result = await negotiationsService.listForQuotation('quote-1', 'customer-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.messages).toHaveLength(1);
    expect(negotiationsRepository.listByQuotationId).toHaveBeenCalledWith('quote-1');
  });
});
