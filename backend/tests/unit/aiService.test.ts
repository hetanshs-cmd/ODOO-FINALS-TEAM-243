import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiService } from '../../src/modules/ai/ai.service';
import { ollamaClient } from '../../src/modules/ai/ollama.client';
import { dealHealthService } from '../../src/modules/deal-health/deal-health.service';
import { approvalsService } from '../../src/modules/approvals/approvals.service';

vi.mock('../../src/modules/ai/ollama.client');
vi.mock('../../src/modules/deal-health/deal-health.service');
vi.mock('../../src/modules/approvals/approvals.service');
vi.mock('../../src/modules/quotations/quotations.service');
vi.mock('../../src/modules/negotiations/negotiations.service');
vi.mock('../../src/modules/reporting/reporting.service');

const requester = { id: 'user-1', role: 'SALES_MANAGER' };

describe('aiService.getInsight', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dealHealthService.listOpenAlerts).mockResolvedValue({
      items: [{ id: 'alert-1', severity: 'HIGH' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    } as never);
  });

  it('returns the parsed model response for a grounded insight', async () => {
    vi.mocked(ollamaClient.chat).mockResolvedValue(
      JSON.stringify({ summary: 'One HIGH severity deal needs attention.', confidence: 'high' }),
    );

    const result = await aiService.getInsight({ type: 'summarize_deal_health' }, requester);

    expect(result).toMatchObject({ summary: 'One HIGH severity deal needs attention.', confidence: 'high' });
    expect(dealHealthService.listOpenAlerts).toHaveBeenCalled();
    expect(ollamaClient.chat).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'system' })]),
      { json: true },
    );
  });

  it('surfaces AI_UNAVAILABLE when the local model cannot be reached', async () => {
    vi.mocked(ollamaClient.chat).mockRejectedValue(
      Object.assign(new Error('unreachable'), { code: 'AI_UNAVAILABLE', statusCode: 503 }),
    );

    await expect(aiService.getInsight({ type: 'summarize_deal_health' }, requester)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('surfaces AI_UNAVAILABLE when the model response is not valid JSON', async () => {
    vi.mocked(ollamaClient.chat).mockResolvedValue('not json');

    await expect(aiService.getInsight({ type: 'summarize_deal_health' }, requester)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('rejects a quotation-scoped insight type with no entityId', async () => {
    await expect(aiService.getInsight({ type: 'explain_risk' }, requester)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('aiService.chat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(approvalsService.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    } as never);
    vi.mocked(dealHealthService.listOpenAlerts).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    } as never);
  });

  it('grounds the reply in the requester\'s own pending approvals and open alerts', async () => {
    vi.mocked(ollamaClient.chat).mockResolvedValue(JSON.stringify({ summary: 'Nothing urgent right now.' }));

    const result = await aiService.chat({ messages: [{ role: 'user', content: 'anything urgent?' }] }, requester);

    expect(result.summary).toBe('Nothing urgent right now.');
    expect(approvalsService.list).toHaveBeenCalledWith({ status: 'PENDING', limit: 10 }, requester);
  });
});
