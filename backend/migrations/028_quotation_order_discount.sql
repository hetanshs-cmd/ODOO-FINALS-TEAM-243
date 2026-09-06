-- Migration: 028_quotation_order_discount.sql
-- Description: Adds an order-level (whole-quotation) discount percentage,
--              distinct from each line item's own discount_percent. The
--              quotation builder UI has always exposed an order-level
--              discount control with no backend column behind it — this
--              closes that gap instead of leaving the UI call a
--              nonexistent endpoint.
--
-- Semantics: order_discount_percent is applied on top of the line-level
-- discounted (taxable) subtotal, and tax is scaled down proportionally
-- with it — equivalent to discounting the whole line_total (taxable +
-- tax) by the same percentage. grand_total is derived as
-- subtotal - discount_total + tax_total so the standard accounting
-- invariant holds exactly (to the cent), rather than being rounded
-- independently.
ALTER TABLE quotations
    ADD COLUMN order_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (order_discount_percent >= 0 AND order_discount_percent <= 100);

DROP VIEW quotation_totals;

CREATE VIEW quotation_totals AS
WITH agg AS (
    SELECT
        q.id AS quotation_id,
        q.order_discount_percent,
        COALESCE(SUM(a.line_subtotal), 0) AS subtotal,
        COALESCE(SUM(a.discount_amount), 0) AS line_discount_total,
        COALESCE(SUM(a.taxable_amount), 0) AS taxable_total,
        COALESCE(SUM(a.tax_amount), 0) AS line_tax_total
    FROM quotations q
    LEFT JOIN quotation_item_amounts a ON a.quotation_id = q.id
    GROUP BY q.id, q.order_discount_percent
)
SELECT
    quotation_id,
    subtotal,
    line_discount_total
        + ROUND(taxable_total * order_discount_percent / 100, 2) AS discount_total,
    ROUND(line_tax_total * (1 - order_discount_percent / 100), 2) AS tax_total,
    subtotal
        - (line_discount_total + ROUND(taxable_total * order_discount_percent / 100, 2))
        + ROUND(line_tax_total * (1 - order_discount_percent / 100), 2) AS grand_total
FROM agg;
