import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvalsRepository } from './approvals.repository';
import { approvalsService } from './approvals.service';
import { findApprovalLevelsAscending } from '../../shared/approvalLevels';
import { ApprovalRequest } from './approvals.model';

/**
 * Unit tests for the approvals service — the repository (and the shared
 * approval-levels lookup) are mocked so these run without a database, per
 * docs/testing.md's "mock repositories" rule.
 *
 * Focused on `act`, which carries this module's real business rules:
 * status re-check under lock, segregation of duties via `assigned_to`, and
 * self-approval prevention. These didn't exist before and weren't covered by
 * any test.
 */
vi.mock('./approvals.repository');
vi.mock('../../shared/approvalLevels');

const FAKE_CLIENT = {} as never;

vi.mock('../../shared/db/withTransaction', () => ({
  withTransaction: async (fn: (client: unknown) => unknown) => fn(FAKE_CLIENT),
}));

vi.mock('../../shared/auditLog', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function makeRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'req-1',
    quotation_id: 'quote-1',
    requested_by: 'rep-1',
    assigned_to: null,
    approval_level_id: 'level-1',
    approval_level: 'Sales Manager Review',
    status: 'PENDING',
    reason: null,
    requested_at: '2026-01-01T00:00:00.000Z',
    responded_at: null,
    ...overrides,
  };
}

describe('approvalsService.act', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(approvalsRepository.insertAction).mockResolvedValue({
      id: 'action-1',
      approval_request_id: 'req-1',
      user_id: 'manager-1',
      action: 'APPROVED',
      comment: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('rejects an unknown approval request', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(null);

    await expect(
      approvalsService.act('missing', { action: 'APPROVED', userId: 'manager-1', actorRole: 'SALES_MANAGER' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects acting on an already-resolved request', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ status: 'APPROVED' }),
    );

    await expect(
      approvalsService.act('req-1', { action: 'APPROVED', userId: 'manager-1', actorRole: 'SALES_MANAGER' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('reads the request under a row lock (findByIdForUpdate), not the unlocked read', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(makeRequest());
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'APPROVED' }));

    await approvalsService.act('req-1', { action: 'APPROVED', userId: 'manager-1', actorRole: 'SALES_MANAGER' });

    expect(approvalsRepository.findByIdForUpdate).toHaveBeenCalledWith(FAKE_CLIENT, 'req-1');
    expect(approvalsRepository.findById).not.toHaveBeenCalled();
  });

  it('blocks a manager who is not the assigned approver', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ assigned_to: 'manager-A' }),
    );

    await expect(
      approvalsService.act('req-1', {
        action: 'APPROVED',
        userId: 'manager-B',
        actorRole: 'SALES_MANAGER',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(approvalsRepository.insertAction).not.toHaveBeenCalled();
  });

  it('allows the assigned approver to act', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ assigned_to: 'manager-A' }),
    );
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'APPROVED' }));

    await expect(
      approvalsService.act('req-1', {
        action: 'APPROVED',
        userId: 'manager-A',
        actorRole: 'SALES_MANAGER',
      }),
    ).resolves.toMatchObject({ request: { status: 'APPROVED' } });
  });

  it('lets an ADMIN act even when a different approver is assigned', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ assigned_to: 'manager-A' }),
    );
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'APPROVED' }));

    await expect(
      approvalsService.act('req-1', { action: 'APPROVED', userId: 'admin-1', actorRole: 'ADMIN' }),
    ).resolves.toMatchObject({ request: { status: 'APPROVED' } });
  });

  it('blocks the requester from approving their own request, even if they hold an approving role', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ requested_by: 'manager-1' }),
    );

    await expect(
      approvalsService.act('req-1', { action: 'APPROVED', userId: 'manager-1', actorRole: 'SALES_MANAGER' }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(approvalsRepository.insertAction).not.toHaveBeenCalled();
  });

  it('allows COMMENTED from anyone, including the requester, without the self-approval check', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ requested_by: 'rep-1', status: 'PENDING' }),
    );
    vi.mocked(approvalsRepository.insertAction).mockResolvedValue({
      id: 'action-1',
      approval_request_id: 'req-1',
      user_id: 'rep-1',
      action: 'COMMENTED',
      comment: 'checking in',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      approvalsService.act('req-1', {
        action: 'COMMENTED',
        userId: 'rep-1',
        actorRole: 'SALES_REP',
        comment: 'checking in',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects on APPROVED: sets status and moves the quotation to APPROVED', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(makeRequest());
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'REJECTED' }));

    await approvalsService.act('req-1', { action: 'REJECTED', userId: 'manager-1', actorRole: 'SALES_MANAGER' });

    expect(approvalsRepository.updateQuotationStatus).toHaveBeenCalledWith(
      FAKE_CLIENT,
      'quote-1',
      'REJECTED',
    );
  });

  it('escalates to the next configured level', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ approval_level_id: 'level-1' }),
    );
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'ESCALATED' }));
    vi.mocked(findApprovalLevelsAscending).mockResolvedValue([
      { id: 'level-1', level: 1 },
      { id: 'level-2', level: 2 },
    ]);
    vi.mocked(approvalsRepository.createEscalatedRequest).mockResolvedValue('req-2');

    const result = await approvalsService.act('req-1', {
      action: 'ESCALATED',
      userId: 'manager-1',
      actorRole: 'SALES_MANAGER',
    });

    expect(result.escalatedRequestId).toBe('req-2');
    expect(approvalsRepository.createEscalatedRequest).toHaveBeenCalledWith(
      FAKE_CLIENT,
      expect.objectContaining({ approvalLevelId: 'level-2' }),
    );
  });

  it('refuses to escalate past the highest configured level', async () => {
    vi.mocked(approvalsRepository.findByIdForUpdate).mockResolvedValue(
      makeRequest({ approval_level_id: 'level-2' }),
    );
    vi.mocked(approvalsRepository.updateStatus).mockResolvedValue(makeRequest({ status: 'ESCALATED' }));
    vi.mocked(findApprovalLevelsAscending).mockResolvedValue([
      { id: 'level-1', level: 1 },
      { id: 'level-2', level: 2 },
    ]);

    await expect(
      approvalsService.act('req-1', { action: 'ESCALATED', userId: 'manager-1', actorRole: 'SALES_MANAGER' }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(approvalsRepository.createEscalatedRequest).not.toHaveBeenCalled();
  });
});
