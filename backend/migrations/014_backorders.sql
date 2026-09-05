-- Migration: 014_backorders.sql
-- Description: Backorders for sales order items that could not be fully
--              fulfilled from available inventory.
-- Depends on: 011_sales_orders.sql, 005_products.sql

CREATE TABLE backorders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id        UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    sales_order_item_id   UUID NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
    product_id            UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity              NUMERIC(12,2) NOT NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    expected_date         DATE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at          TIMESTAMPTZ,
    CONSTRAINT chk_backorders_quantity CHECK (quantity > 0),
    CONSTRAINT chk_backorders_status CHECK (
        status IN ('OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')
    )
);
CREATE INDEX idx_backorders_sales_order_id ON backorders(sales_order_id);
CREATE INDEX idx_backorders_sales_order_item_id ON backorders(sales_order_item_id);
CREATE INDEX idx_backorders_product_id ON backorders(product_id);
CREATE INDEX idx_backorders_status ON backorders(status);
