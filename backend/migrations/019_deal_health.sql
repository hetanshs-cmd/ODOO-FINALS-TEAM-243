-- Migration: 019_deal_health.sql
-- Description: Deal health scoring history and anomaly/risk alerts per
--              quotation. quotation_id is intentionally NOT unique on
--              deal_health_scores so score history over time is preserved.
-- Depends on: 006_quotations.sql

CREATE TABLE deal_health_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id        UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    score               NUMERIC(5,2) NOT NULL,
    risk_level          VARCHAR(20) NOT NULL,
    discount_risk       NUMERIC(5,2) NOT NULL,
    negotiation_risk    NUMERIC(5,2) NOT NULL,
    delay_risk          NUMERIC(5,2) NOT NULL,
    fulfillment_risk    NUMERIC(5,2) NOT NULL,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_deal_health_scores_score CHECK (score >= 0 AND score <= 100),
    CONSTRAINT chk_deal_health_scores_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT chk_deal_health_scores_discount_risk CHECK (discount_risk >= 0 AND discount_risk <= 100),
    CONSTRAINT chk_deal_health_scores_negotiation_risk CHECK (negotiation_risk >= 0 AND negotiation_risk <= 100),
    CONSTRAINT chk_deal_health_scores_delay_risk CHECK (delay_risk >= 0 AND delay_risk <= 100),
    CONSTRAINT chk_deal_health_scores_fulfillment_risk CHECK (fulfillment_risk >= 0 AND fulfillment_risk <= 100)
);
CREATE INDEX idx_deal_health_scores_quotation_id ON deal_health_scores(quotation_id);
CREATE INDEX idx_deal_health_scores_risk_level ON deal_health_scores(risk_level);
CREATE INDEX idx_deal_health_scores_calculated_at ON deal_health_scores(calculated_at);

CREATE TABLE deal_alerts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id   UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    alert_type     VARCHAR(50) NOT NULL,
    severity       VARCHAR(20) NOT NULL,
    message        TEXT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ,
    CONSTRAINT chk_deal_alerts_type CHECK (alert_type IN ('STALLED', 'DISCOUNT_ANOMALY', 'DELIVERY_SLIPPAGE')),
    CONSTRAINT chk_deal_alerts_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_deal_alerts_status CHECK (status IN ('OPEN', 'ESCALATED', 'NUDGED', 'RESOLVED'))
);
CREATE INDEX idx_deal_alerts_quotation_id ON deal_alerts(quotation_id);
CREATE INDEX idx_deal_alerts_severity ON deal_alerts(severity);
CREATE INDEX idx_deal_alerts_status ON deal_alerts(status);
CREATE INDEX idx_deal_alerts_created_at ON deal_alerts(created_at);
