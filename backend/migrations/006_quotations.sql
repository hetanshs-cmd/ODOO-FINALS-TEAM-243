-- Migration: 006_quotations.sql
-- Description: Quotations (the central business object) and their line items.
-- Depends on: 004_customers.sql, 003_rbac.sql (users), 005_products.sql
--
-- Money totals (subtotal / discount_total / tax_total / grand_total) are NOT
-- stored on either table: they are derived from quotation_items at read time
-- (quantity, unit_price, discount_percent, tax_percent are the only inputs a
-- total needs), so a quotation can never disagree with its own line items.
CREATE TABLE quotations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number  VARCHAR(50) NOT NULL UNIQUE,
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_rep_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    price_list_id     UUID REFERENCES price_lists(id) ON DELETE SET NULL,
    status            VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    currency          VARCHAR(3)  NOT NULL,
    valid_until       DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quotations_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
        'SENT_TO_CUSTOMER', 'NEGOTIATION', 'ACCEPTED', 'DECLINED',
        'EXPIRED', 'CANCELLED', 'CONVERTED'
    ))
);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_sales_rep_id ON quotations(sales_rep_id);
CREATE INDEX idx_quotations_price_list_id ON quotations(price_list_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_created_at ON quotations(created_at);
CREATE TRIGGER trg_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- quantity is NUMERIC (not INTEGER) because `products.unit` may be fractional
-- (e.g. kg, hours of service), not just discrete countable units.
CREATE TABLE quotation_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id      UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    description       TEXT,
    quantity          NUMERIC(12,2) NOT NULL,
    unit_price        NUMERIC(14,2) NOT NULL,
    discount_percent  NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_percent       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    billing_type      VARCHAR(20)   NOT NULL,
    CONSTRAINT chk_quotation_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_quotation_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_quotation_items_discount_percent CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT chk_quotation_items_tax_percent CHECK (tax_percent >= 0 AND tax_percent <= 100),
    CONSTRAINT chk_quotation_items_billing_type CHECK (billing_type IN ('ONE_TIME', 'RECURRING'))
);
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX idx_quotation_items_product_id ON quotation_items(product_id);

-- The single definition of quotation money math. Every reader (API responses,
-- approvals, negotiation, conversion to a sales order, reporting) selects from
-- these views instead of recomputing the formula — or storing it.
-- Rounding is applied per step so results match to the cent regardless of
-- whether a caller reads one line or a whole-quotation total.
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
