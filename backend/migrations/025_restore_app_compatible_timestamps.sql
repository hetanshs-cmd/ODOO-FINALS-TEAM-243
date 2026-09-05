-- Migration: 025_restore_app_compatible_timestamps.sql
-- Description: Restores `created_at` on the specific tables where the
--              2026-09-05 schema-minimization refactor (migrations 003-022,
--              rewritten in place) dropped it out from under still-live
--              application code. That refactor's own commit message notes
--              "application code has not been updated to match this schema
--              yet" — this migration closes exactly that gap for the one
--              category of breakage that is a pure, safe addition: ordering
--              by created_at. It does NOT touch or reverse the refactor's
--              real design changes (the derived-totals views, or dropping
--              customer_users in favor of users.customer_id) — those are a
--              separate, larger reconciliation tracked in CODEBASE_AUDIT.md
--              and are out of scope here.
--
-- Every table below is hit by a concrete, currently-shipping query:
--   quotation_items   — quotations.repository.ts (2x), portal.repository.ts
--   sales_orders      — sales-orders.repository.ts (list)
--   sales_order_items — sales-orders.repository.ts (listItems)
--   fulfillments      — fulfillment.repository.ts (listBySalesOrder)
--   invoices          — billing.repository.ts (listInvoices)
--   payments          — payments.repository.ts (listForInvoice)
--   subscriptions     — subscriptions.repository.ts (list)
--   customer_tiers, discount_rules, approval_levels, price_lists,
--   product_categories, recommendation_rules, warehouses,
--   subscription_plans
--                     — every one of these is a shared/crud/crudRepository
--                       resource, whose list() ORDER BY defaults to
--                       "created_at DESC" and is never overridden by these
--                       admin/*.ts resource configs (checked: none of them
--                       set defaultOrderBy).
--
-- Backfilled to now() for any pre-existing rows so NOT NULL holds
-- immediately; the DEFAULT keeps future inserts correct without app changes.
ALTER TABLE quotation_items    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sales_orders       ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sales_order_items  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fulfillments       ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE invoices           ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE payments           ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE subscriptions      ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE customer_tiers     ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE discount_rules     ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE approval_levels    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE price_lists        ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE product_categories ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recommendation_rules ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE warehouses         ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE subscription_plans ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Every ORDER BY created_at on these tables in current app code is DESC
-- except quotation_items/sales_order_items (ASC, oldest line first) — an
-- index that supports both directions is enough; add one per table so the
-- newly-added column doesn't force a sequential scan on these list/order
-- endpoints, matching this schema's existing pattern of an index per
-- frequently-filtered/sorted column.
CREATE INDEX idx_quotation_items_created_at    ON quotation_items(created_at);
CREATE INDEX idx_sales_orders_created_at       ON sales_orders(created_at);
CREATE INDEX idx_sales_order_items_created_at  ON sales_order_items(created_at);
CREATE INDEX idx_fulfillments_created_at       ON fulfillments(created_at);
CREATE INDEX idx_invoices_created_at           ON invoices(created_at);
CREATE INDEX idx_payments_created_at           ON payments(created_at);
CREATE INDEX idx_subscriptions_created_at      ON subscriptions(created_at);
