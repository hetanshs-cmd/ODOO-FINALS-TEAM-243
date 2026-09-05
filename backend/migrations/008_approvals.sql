-- Migration: 008_approvals.sql
-- Description: Approval routing/escalation levels, requests, and their
--              full action history (not just the latest decision).
-- Depends on: 006_quotations.sql, 003_rbac.sql (users)

CREATE TABLE approval_levels (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    level        INTEGER NOT NULL UNIQUE,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_approval_levels_level CHECK (level > 0)
);
CREATE TRIGGER trg_approval_levels_updated_at
    BEFORE UPDATE ON approval_levels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- quotation_id: RESTRICT — approval_requests is business-critical approval
-- history and must never be silently cascaded away by deleting the quotation.
CREATE TABLE approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    requested_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_level  UUID NOT NULL REFERENCES approval_levels(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reason          TEXT,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_approval_requests_status CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED')
    )
);
CREATE INDEX idx_approval_requests_quotation_id ON approval_requests(quotation_id);
CREATE INDEX idx_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX idx_approval_requests_assigned_to ON approval_requests(assigned_to);
CREATE INDEX idx_approval_requests_approval_level ON approval_requests(approval_level);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE TRIGGER trg_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only action log per approval request, so the full approval
-- history (not only the current status) is preserved for audit.
CREATE TABLE approval_actions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id  UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action               VARCHAR(20) NOT NULL,
    comment              TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_approval_actions_action CHECK (
        action IN ('APPROVED', 'REJECTED', 'ESCALATED', 'COMMENTED', 'CANCELLED')
    )
);
CREATE INDEX idx_approval_actions_approval_request_id ON approval_actions(approval_request_id);
CREATE INDEX idx_approval_actions_user_id ON approval_actions(user_id);
