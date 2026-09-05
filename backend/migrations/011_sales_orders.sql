-- Migration: 011_sales_orders.sql
-- Description: Sales orders (converted from an accepted quotation) and
--              their line items, tracking partial fulfillment/backorder.
-- Depends on: 006_quotations.sql, 004_customers.sql, 003_rbac.sql, 005_products.sql

-- quotation_id is UNIQUE: a quotation converts into at most one sales order.
CREATE TABLE sales_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    quotation_id    UUID NOT NULL UNIQUE REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_rep_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sales_orders_status CHECK (
        status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')
    ),
    CONSTRAINT chk_sales_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_sales_orders_discount_total CHECK (discount_total >= 0),
    CONSTRAINT chk_sales_orders_tax_total CHECK (tax_total >= 0),
    CONSTRAINT chk_sales_orders_grand_total CHECK (grand_total >= 0)
);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_sales_rep_id ON sales_orders(sales_rep_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE TRIGGER trg_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sales_order_items (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id         UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id             UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity               NUMERIC(12,2) NOT NULL,
    unit_price             NUMERIC(14,2) NOT NULL,
    discount               NUMERIC(14,2) NOT NULL DEFAULT 0,
    total                  NUMERIC(14,2) NOT NULL,
    fulfilled_quantity     NUMERIC(12,2) NOT NULL DEFAULT 0,
    backordered_quantity   NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sales_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_sales_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sales_order_items_discount CHECK (discount >= 0),
    CONSTRAINT chk_sales_order_items_total CHECK (total >= 0),
    CONSTRAINT chk_sales_order_items_fulfilled_quantity CHECK (fulfilled_quantity >= 0),
    CONSTRAINT chk_sales_order_items_backordered_quantity CHECK (backordered_quantity >= 0),
    CONSTRAINT chk_sales_order_items_fulfilled_le_qty CHECK (fulfilled_quantity <= quantity),
    CONSTRAINT chk_sales_order_items_backordered_le_qty CHECK (backordered_quantity <= quantity)
);
CREATE INDEX idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product_id ON sales_order_items(product_id);
CREATE TRIGGER trg_sales_order_items_updated_at
    BEFORE UPDATE ON sales_order_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
