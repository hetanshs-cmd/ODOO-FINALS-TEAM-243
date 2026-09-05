export interface DealHealthScoreRow {
  id: string;
  quotation_id: string;
  score: string;
  risk_level: string;
  discount_risk: string;
  negotiation_risk: string;
  delay_risk: string;
  fulfillment_risk: string;
  calculated_at: string;
  created_at: string;
}

export interface DealAlertRow {
  id: string;
  quotation_id: string;
  alert_type: string;
  severity: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}
