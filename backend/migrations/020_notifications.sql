-- Migration: 020_notifications.sql
-- Description: In-app notifications for users. reference_type/reference_id
--              point logically to another entity (quotation, order, invoice,
--              etc.) without a polymorphic FK, since Postgres cannot express
--              "references one of several tables" as a real foreign key.
-- Depends on: 003_rbac.sql (users)

CREATE TABLE notifications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             VARCHAR(50) NOT NULL,
    title            VARCHAR(200) NOT NULL,
    message          TEXT NOT NULL,
    reference_type   VARCHAR(50),
    reference_id     UUID,
    is_read          BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
