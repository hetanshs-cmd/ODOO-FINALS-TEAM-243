import { db } from '../config/database';
import { RiskLevel } from '../modules/discount-engine/discountEngine';

export interface ApprovalLevelRef {
  id: string;
  level: number;
  /** roles.name of the staff role that may action a request at this level. */
  required_role: string;
}

/**
 * Shared by discount-engine (routing a newly-flagged quotation) and
 * approvals (escalating an in-flight request, advancing the chain) — all
 * need the same ascending-by-level view of admin-configured approval_levels.
 */
export async function findApprovalLevelsAscending(): Promise<ApprovalLevelRef[]> {
  const { rows } = await db.query(
    'SELECT id, level, required_role FROM approval_levels ORDER BY level ASC',
  );
  return rows as ApprovalLevelRef[];
}

/**
 * The ordered sequence of approval levels a quotation must clear for a given
 * blended risk level — the "current step controls who acts" chain:
 *
 *   MEDIUM -> [lowest level]                 (e.g. Sales Manager)
 *   HIGH   -> [lowest, second-lowest]        (e.g. Sales Manager -> Finance)
 *   LOW    -> []                             (auto-approved, no chain)
 *
 * Derived from whatever levels admins have configured rather than hardcoded
 * level numbers; if only one level exists, HIGH collapses to that one.
 */
export function approvalChainForRisk(
  riskLevel: RiskLevel,
  levelsAscending: ApprovalLevelRef[],
): ApprovalLevelRef[] {
  if (riskLevel === 'LOW' || levelsAscending.length === 0) return [];
  if (riskLevel === 'MEDIUM') return [levelsAscending[0]!];
  return levelsAscending.slice(0, 2);
}
