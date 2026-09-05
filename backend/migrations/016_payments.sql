-- Migration: 016_payments.sql
-- Description: Payments made against invoices.
-- Depends on: 015_billing_invoices.sql, 004_customers.sql

CREATE TABLE payments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id            UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount                 NUMERIC(14,2) NOT NULL,
    payment_method         VARCHAR(30) NOT NULL,
    transaction_reference  VARCHAR(100),
    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    paid_at                TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payments_amount CHECK (amount > 0),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'))
);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
-- Partial unique index: a transaction reference must be unique when present,
-- but most gateways only assign one after a successful attempt.
CREATE UNIQUE INDEX uq_payments_transaction_reference
    ON payments(transaction_reference)
    WHERE transaction_reference IS NOT NULL;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
