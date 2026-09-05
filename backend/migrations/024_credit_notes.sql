-- Migration: 024_credit_notes.sql
-- Description: Credit notes issued against a subscription downgrade or
--              cancellation refund. Kept as its own table rather than
--              reusing billing_schedules, since billing_schedules.amount
--              has a `>= 0` CHECK meant for upcoming charges — a credit
--              note represents money owed back to the customer, a distinct
--              concept that table can't represent.
-- Depends on: 004_customers.sql (customers), 017_subscriptions.sql (subscriptions)

CREATE TABLE credit_notes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount           NUMERIC(12,2) NOT NULL,
    reason           TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_credit_notes_amount CHECK (amount >= 0),
    CONSTRAINT chk_credit_notes_status CHECK (status IN ('PENDING', 'APPLIED', 'VOIDED'))
);
CREATE INDEX idx_credit_notes_subscription_id ON credit_notes(subscription_id);
CREATE INDEX idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX idx_credit_notes_status ON credit_notes(status);
CREATE INDEX idx_credit_notes_created_at ON credit_notes(created_at);
