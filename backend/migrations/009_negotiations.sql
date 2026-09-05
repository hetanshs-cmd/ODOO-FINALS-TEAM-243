-- Migration: 009_negotiations.sql
-- Description: Quotation negotiation threads, messages, and tracked field
--              changes (used to detect re-approval-triggering changes).
-- Depends on: 006_quotations.sql, 003_rbac.sql (users)

-- quotation_id: RESTRICT — negotiations is business-critical negotiation
-- history and must never be silently cascaded away by deleting the quotation.
CREATE TABLE negotiations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id   UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    initiated_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status         VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at      TIMESTAMPTZ,
    CONSTRAINT chk_negotiations_status CHECK (
        status IN ('OPEN', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'CLOSED')
    )
);
CREATE INDEX idx_negotiations_quotation_id ON negotiations(quotation_id);
CREATE INDEX idx_negotiations_initiated_by ON negotiations(initiated_by);
CREATE INDEX idx_negotiations_status ON negotiations(status);

CREATE TABLE negotiation_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id  UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    sender_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message         TEXT NOT NULL,
    message_type    VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_negotiation_messages_type CHECK (message_type IN ('TEXT', 'COUNTER_OFFER', 'SYSTEM'))
);
CREATE INDEX idx_negotiation_messages_negotiation_id ON negotiation_messages(negotiation_id);
CREATE INDEX idx_negotiation_messages_sender_user_id ON negotiation_messages(sender_user_id);
CREATE INDEX idx_negotiation_messages_created_at ON negotiation_messages(created_at);

-- Tracks the before/after of any negotiated field (e.g. quotation_items.
-- discount_percent) so the service layer can detect whether a negotiated
-- change exceeds the original approval threshold and needs re-approval.
CREATE TABLE negotiation_changes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id      UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    quotation_item_id   UUID REFERENCES quotation_items(id) ON DELETE CASCADE,
    field_name          VARCHAR(100) NOT NULL,
    old_value           TEXT,
    new_value           TEXT,
    changed_by          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_negotiation_changes_negotiation_id ON negotiation_changes(negotiation_id);
CREATE INDEX idx_negotiation_changes_quotation_item_id ON negotiation_changes(quotation_item_id);
CREATE INDEX idx_negotiation_changes_changed_by ON negotiation_changes(changed_by);
