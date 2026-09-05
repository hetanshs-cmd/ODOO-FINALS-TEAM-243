-- Migration: 027_fix_item_amounts_views_missing_created_at.sql
-- Description: Fixes a live bug confirmed by running migrations 002-026
--              against a fresh database and executing the integration suite
--              against it: `quotation_item_amounts`, `sales_order_item_amounts`,
--              and `invoice_item_amounts` (006/011/015) were created via
--              `SELECT qi.*, ...` BEFORE migration 025 added `created_at` to
--              their base tables. Postgres expands `*` into the concrete
--              column list at CREATE VIEW time and freezes it — a later
--              `ALTER TABLE ... ADD COLUMN` does NOT propagate into an
--              existing view, no matter what the view's query text says.
--              Confirmed via `pg_get_viewdef`: none of the three views
--              expose `created_at`, even though `quotation_items`,
--              `sales_order_items`, and `invoice_items` all have it.
--
-- Impact before this fix: every query that reads `created_at` from one of
-- these views 500s with "column created_at does not exist" —
-- quotations.repository.ts:listItems/addItem, sales-orders.repository.ts:
-- listItems, billing.repository.ts:listInvoiceItems/insertInvoiceItem/
-- findInvoiceItemById, and portal.repository.ts's item listings for both
-- quotations and invoices. Reproduced live via
-- tests/integration/portal-resources.test.ts.
--
-- A second, related gap found while fixing this: migration 025 restored
-- `created_at` on `invoices` (the header) but never on `invoice_items` (the
-- lines) — yet billing.repository.ts explicitly selects `created_at` from
-- `invoice_item_amounts` (listInvoiceItems/insertInvoiceItem/
-- findInvoiceItemById). Adding it here too, before recreating the view that
-- depends on it.
ALTER TABLE invoice_items ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_invoice_items_created_at ON invoice_items(created_at);

-- Fix: DROP and CREATE (not CREATE OR REPLACE) each view, because
-- CREATE OR REPLACE VIEW only allows appending new columns at the very end
-- of the output list — `created_at` needs to sit where the old `qi.*`-style
-- expansion would now naturally place it, ahead of every computed column,
-- which shifts existing column positions and REPLACE forbids that. The
-- totals views are pure aggregates over the item_amounts views (no
-- created_at involved) and are unaffected in definition, but must be
-- dropped first since they depend on the views being replaced, then
-- recreated identically.

DROP VIEW quotation_totals;
DROP VIEW quotation_item_amounts;

CREATE VIEW quotation_item_amounts AS
SELECT
    t.*,
    ROUND(t.taxable_amount * t.tax_percent / 100, 2) AS tax_amount,
    t.taxable_amount + ROUND(t.taxable_amount * t.tax_percent / 100, 2) AS line_total
FROM (
    SELECT
        qi.*,
        ROUND(qi.quantity * qi.unit_price, 2) AS line_subtotal,
        ROUND(qi.quantity * qi.unit_price * qi.discount_percent / 100, 2) AS discount_amount,
        ROUND(qi.quantity * qi.unit_price, 2)
            - ROUND(qi.quantity * qi.unit_price * qi.discount_percent / 100, 2) AS taxable_amount
    FROM quotation_items qi
) t;

CREATE VIEW quotation_totals AS
SELECT
    q.id                                 AS quotation_id,
    COALESCE(SUM(a.line_subtotal), 0)    AS subtotal,
    COALESCE(SUM(a.discount_amount), 0)  AS discount_total,
    COALESCE(SUM(a.tax_amount), 0)       AS tax_total,
    COALESCE(SUM(a.line_total), 0)       AS grand_total
FROM quotations q
LEFT JOIN quotation_item_amounts a ON a.quotation_id = q.id
GROUP BY q.id;

DROP VIEW sales_order_totals;
DROP VIEW sales_order_item_amounts;

CREATE VIEW sales_order_item_amounts AS
SELECT
    t.*,
    ROUND(t.taxable_amount * t.tax_percent / 100, 2) AS tax_amount,
    t.taxable_amount + ROUND(t.taxable_amount * t.tax_percent / 100, 2) AS total
FROM (
    SELECT
        soi.*,
        ROUND(soi.quantity * soi.unit_price, 2) AS line_subtotal,
        ROUND(soi.quantity * soi.unit_price, 2) - soi.discount AS taxable_amount
    FROM sales_order_items soi
) t;

CREATE VIEW sales_order_totals AS
SELECT
    so.id                              AS sales_order_id,
    COALESCE(SUM(a.line_subtotal), 0)  AS subtotal,
    COALESCE(SUM(a.discount), 0)       AS discount_total,
    COALESCE(SUM(a.tax_amount), 0)     AS tax_total,
    COALESCE(SUM(a.total), 0)          AS grand_total
FROM sales_orders so
LEFT JOIN sales_order_item_amounts a ON a.sales_order_id = so.id
GROUP BY so.id;

DROP VIEW invoice_totals;
DROP VIEW invoice_item_amounts;

CREATE VIEW invoice_item_amounts AS
SELECT
    t.*,
    ROUND(t.line_subtotal * t.tax_percent / 100, 2) AS tax_amount,
    t.line_subtotal + ROUND(t.line_subtotal * t.tax_percent / 100, 2) AS total
FROM (
    SELECT ii.*, ROUND(ii.quantity * ii.unit_price, 2) AS line_subtotal
    FROM invoice_items ii
) t;

CREATE VIEW invoice_totals AS
SELECT
    i.id                               AS invoice_id,
    COALESCE(SUM(a.line_subtotal), 0)  AS subtotal,
    COALESCE(SUM(a.tax_amount), 0)     AS tax_total,
    COALESCE(SUM(a.total), 0)          AS total
FROM invoices i
LEFT JOIN invoice_item_amounts a ON a.invoice_id = i.id
GROUP BY i.id;
