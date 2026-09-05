import { db } from '../config/database';

export interface ApprovalLevelRef {
  id: string;
  level: number;
}

/**
 * Shared by discount-engine (routing a newly-flagged quotation) and
 * approvals (escalating an in-flight request) — both need the same
 * ascending-by-level view of admin-configured approval_levels.
 */
export async function findApprovalLevelsAscending(): Promise<ApprovalLevelRef[]> {
  const { rows } = await db.query('SELECT id, level FROM approval_levels ORDER BY level ASC');
  return rows as ApprovalLevelRef[];
}
