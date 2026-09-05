-- Migration: 011_sales_orders.sql
-- Description: Sales orders (converted from an accepted quotation) and
--              their line items, tracking partial fulfillment.
-- Depends on: 006_quotations.sql, 004_customers.sql, 003_rbac.sql, 005_products.sql
--
-- Like quotations, a sales order stores no money totals: they are derived
-- from sales_order_items (quantity, unit_price, discount, tax_percent).

-- quotation_id is UNIQUE: a quotation converts into at most one sales order.
CREATE TABLE sales_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    quotation_id    UUID NOT NULL UNIQUE REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_rep_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT chk_sales_orders_status CHECK (
        status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')
    )
);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_sales_rep_id ON sales_orders(sales_rep_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_order_date ON sales_orders(order_date);

-- `discount` is an absolute per-line amount frozen at conversion time (what
-- the customer actually agreed to), not a percentage — it is a fact, not a
-- derived value. backordered quantity is not stored here: the backorders
-- table already records exactly that, per line.
CREATE TABLE sales_order_items (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id         UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id             UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity               NUMERIC(12,2) NOT NULL,
    unit_price             NUMERIC(14,2) NOT NULL,
    discount               NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_percent            NUMERIC(5,2)  NOT NULL DEFAULT 0,
    fulfilled_quantity     NUMERIC(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT chk_sales_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_sales_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sales_order_items_discount CHECK (discount >= 0),
    CONSTRAINT chk_sales_order_items_tax_percent CHECK (tax_percent >= 0 AND tax_percent <= 100),
    CONSTRAINT chk_sales_order_items_fulfilled_quantity CHECK (fulfilled_quantity >= 0),
    CONSTRAINT chk_sales_order_items_fulfilled_le_qty CHECK (fulfilled_quantity <= quantity)
);
CREATE INDEX idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product_id ON sales_order_items(product_id);

-- Sales order money math, defined once (mirrors quotation_item_amounts /
-- quotation_totals in 006, but with a per-line absolute `discount` frozen at
-- conversion time rather than a percentage).
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
