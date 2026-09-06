import { PoolClient } from 'pg';
import { db } from '../../config/database';
import {
  ApprovalAction,
  ApprovalActionRow,
  ApprovalRequest,
  ApprovalRequestStatus,
} from './approvals.model';

export const approvalsRepository = {
  async list(
    status: string | undefined,
    requestedBy: string | undefined,
    quotationId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<ApprovalRequest[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      conditions.push(`ar.status = $${params.length}`);
    }
    if (requestedBy) {
      params.push(requestedBy);
      conditions.push(`ar.requested_by = $${params.length}`);
    }
    if (quotationId) {
      params.push(quotationId);
      conditions.push(`ar.quotation_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT ar.*, al.name AS approval_level
       FROM approval_requests ar
       JOIN approval_levels al ON al.id = ar.approval_level_id
       ${where}
       ORDER BY ar.requested_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as ApprovalRequest[];
  },

  async count(
    status: string | undefined,
    requestedBy: string | undefined,
    quotationId: string | undefined,
  ): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (requestedBy) {
      params.push(requestedBy);
      conditions.push(`requested_by = $${params.length}`);
    }
    if (quotationId) {
      params.push(quotationId);
      conditions.push(`quotation_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM approval_requests ${where}`,
      params,
    );
    return parseInt((rows[0] as { count: string }).count, 10);
  },

  async findById(id: string): Promise<ApprovalRequest | null> {
    const { rows } = await db.query(
      `SELECT ar.*, al.name AS approval_level
       FROM approval_requests ar
       JOIN approval_levels al ON al.id = ar.approval_level_id
       WHERE ar.id = $1`,
      [id],
    );
    return (rows[0] as ApprovalRequest | undefined) ?? null;
  },

  /**
   * Same read under a row lock, for `act`. The status check and the status
   * write must not be separable: two managers hitting Approve at the same
   * moment both used to pass the `status === 'PENDING'` check, producing two
   * APPROVED action rows and two quotation status writes for one request.
   */
  async findByIdForUpdate(client: PoolClient, id: string): Promise<ApprovalRequest | null> {
    const { rows } = await client.query(
      `SELECT ar.*, al.name AS approval_level, al.level AS approval_level_num,
              al.required_role AS approval_level_required_role
       FROM approval_requests ar
       JOIN approval_levels al ON al.id = ar.approval_level_id
       WHERE ar.id = $1
       FOR UPDATE OF ar`,
      [id],
    );
    return (rows[0] as ApprovalRequest | undefined) ?? null;
  },

  /**
   * The highest per-item risk level from the quotation's most recent
   * discount evaluation — used by `act` to know how many approval steps the
   * chain has (MEDIUM = 1, HIGH = 2). Returns null if never evaluated.
   */
  async findLatestRiskLevelForQuotation(
    client: PoolClient,
    quotationId: string,
  ): Promise<'LOW' | 'MEDIUM' | 'HIGH' | null> {
    const { rows } = await client.query(
      `SELECT risk_level
       FROM discount_evaluations
       WHERE quotation_id = $1
       ORDER BY CASE risk_level WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
                evaluated_at DESC
       LIMIT 1`,
      [quotationId],
    );
    return (rows[0] as { risk_level: 'LOW' | 'MEDIUM' | 'HIGH' } | undefined)?.risk_level ?? null;
  },

  async createNextChainRequest(
    client: PoolClient,
    input: { quotationId: string; requestedBy: string; approvalLevelId: string; reason: string },
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO approval_requests (quotation_id, requested_by, approval_level_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.quotationId, input.requestedBy, input.approvalLevelId, input.reason],
    );
    return (rows[0] as { id: string }).id;
  },

  async listActions(approvalRequestId: string): Promise<ApprovalActionRow[]> {
    const { rows } = await db.query(
      'SELECT * FROM approval_actions WHERE approval_request_id = $1 ORDER BY created_at ASC',
      [approvalRequestId],
    );
    return rows as ApprovalActionRow[];
  },

  async insertAction(
    client: PoolClient,
    input: {
      approvalRequestId: string;
      userId: string;
      action: ApprovalAction;
      comment: string | null;
    },
  ): Promise<ApprovalActionRow> {
    const { rows } = await client.query(
      `INSERT INTO approval_actions (approval_request_id, user_id, action, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.approvalRequestId, input.userId, input.action, input.comment],
    );
    return rows[0] as ApprovalActionRow;
  },

  async updateStatus(
    client: PoolClient,
    id: string,
    status: ApprovalRequestStatus,
  ): Promise<ApprovalRequest> {
    const { rows } = await client.query(
      `WITH updated AS (
         UPDATE approval_requests SET status = $2, responded_at = now() WHERE id = $1 RETURNING *
       )
       SELECT updated.*, al.name AS approval_level
       FROM updated JOIN approval_levels al ON al.id = updated.approval_level_id`,
      [id, status],
    );
    return rows[0] as ApprovalRequest;
  },

  async createEscalatedRequest(
    client: PoolClient,
    input: { quotationId: string; requestedBy: string; approvalLevelId: string; reason: string },
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO approval_requests (quotation_id, requested_by, approval_level_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.quotationId, input.requestedBy, input.approvalLevelId, input.reason],
    );
    return (rows[0] as { id: string }).id;
  },

  async updateQuotationStatus(
    client: PoolClient,
    quotationId: string,
    status: string,
  ): Promise<void> {
    await client.query('UPDATE quotations SET status = $2 WHERE id = $1', [quotationId, status]);
  },

  /** For the approval-detail screen's risk breakdown (docs/architecture.md). */
  async findLatestEvaluationsForQuotation(quotationId: string): Promise<
    {
      quotation_item_id: string | null;
      requested_discount: string;
      allowed_discount: string;
      risk_level: string;
      decision: string;
    }[]
  > {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (quotation_item_id) quotation_item_id, requested_discount, allowed_discount, risk_level, decision
       FROM discount_evaluations
       WHERE quotation_id = $1
       ORDER BY quotation_item_id, evaluated_at DESC`,
      [quotationId],
    );
    return rows;
  },
};
