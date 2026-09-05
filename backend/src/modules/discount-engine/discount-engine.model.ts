import { RiskLevel } from './discountEngine';

export interface DiscountEvaluationRow {
  id: string;
  quotation_id: string;
  quotation_item_id: string | null;
  requested_discount: string;
  allowed_discount: string;
  risk_score: string;
  risk_level: RiskLevel;
  decision: 'AUTO_APPROVED' | 'REQUIRES_APPROVAL' | 'REJECTED';
  evaluated_at: string;
  created_at: string;
}

export interface CheckDiscountsResult {
  quotationId: string;
  status: string;
  blendedScore: number;
  riskLevel: RiskLevel;
  evaluations: DiscountEvaluationRow[];
  approvalRequestId: string | null;
}
