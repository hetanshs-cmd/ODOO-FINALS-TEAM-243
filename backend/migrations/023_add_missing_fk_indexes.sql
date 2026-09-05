-- Migration: 023_add_missing_fk_indexes.sql
-- Description: Adds indexes on three FK columns that 009_negotiations.sql and
--              017_subscriptions.sql defined but never indexed, violating
--              002_extensions_and_helpers.sql's own "always index FK columns"
--              rule. Found during a full backend/database audit.
-- Depends on: 009_negotiations.sql, 017_subscriptions.sql

CREATE INDEX idx_negotiations_initiated_by ON negotiations(initiated_by);
CREATE INDEX idx_subscriptions_sales_order_id ON subscriptions(sales_order_id);
CREATE INDEX idx_subscriptions_quotation_id ON subscriptions(quotation_id);
