-- Migration: 018_billing_schedules.sql
-- Description: Scheduled recurring billing events for a subscription, each
--              eventually linked to the invoice it generates.
-- Depends on: 017_subscriptions.sql, 015_billing_invoices.sql

CREATE TABLE billing_schedules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    billing_date     DATE NOT NULL,
    amount           NUMERIC(14,2) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_billing_schedules_amount CHECK (amount >= 0),
    CONSTRAINT chk_billing_schedules_status CHECK (
        status IN ('SCHEDULED', 'INVOICED', 'PAID', 'FAILED', 'CANCELLED')
    )
);
CREATE INDEX idx_billing_schedules_subscription_id ON billing_schedules(subscription_id);
CREATE INDEX idx_billing_schedules_billing_date ON billing_schedules(billing_date);
CREATE INDEX idx_billing_schedules_status ON billing_schedules(status);
CREATE INDEX idx_billing_schedules_invoice_id ON billing_schedules(invoice_id);
CREATE TRIGGER trg_billing_schedules_updated_at
    BEFORE UPDATE ON billing_schedules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
