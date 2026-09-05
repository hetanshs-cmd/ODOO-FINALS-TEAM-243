-- Migration: 015_billing_invoices.sql
-- Description: Invoices and invoice line items. Supports one-time billing
--              (from a sales order/quotation) and recurring billing (from
--              a subscription's billing schedule, hence the nullable FKs).
-- Depends on: 004_customers.sql, 011_sales_orders.sql, 006_quotations.sql, 005_products.sql
--
-- An invoice stores no money totals: subtotal / tax / total are derived from
-- invoice_items (quantity, unit_price, tax_percent) whenever they are needed,
-- so an invoice header can never disagree with the lines it is billing for.
CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number    VARCHAR(50) NOT NULL UNIQUE,
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id    UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    quotation_id      UUID REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_type      VARCHAR(20) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    due_date          DATE,
    issued_at         TIMESTAMPTZ,
    paid_at           TIMESTAMPTZ,
    CONSTRAINT chk_invoices_type CHECK (invoice_type IN ('ONE_TIME', 'RECURRING')),
    CONSTRAINT chk_invoices_status CHECK (
        status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')
    )
);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_sales_order_id ON invoices(sales_order_id);
CREATE INDEX idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- `description` is a deliberate point-in-time snapshot of the product name as
-- it was billed; everything else is the raw input a line total is computed from.
CREATE TABLE invoice_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
    description   VARCHAR(255) NOT NULL,
    quantity      NUMERIC(12,2) NOT NULL,
    unit_price    NUMERIC(14,2) NOT NULL,
    tax_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
    CONSTRAINT chk_invoice_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_invoice_items_tax_percent CHECK (tax_percent >= 0 AND tax_percent <= 100)
);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product_id ON invoice_items(product_id);

-- Invoice money math, defined once. Payment settlement compares what has been
-- paid against invoice_totals.total, so an invoice can never be marked PAID
-- against a stale stored figure.
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
