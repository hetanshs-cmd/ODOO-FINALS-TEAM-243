-- Migration: 013_fulfillment.sql
-- Description: Fulfillments and their items — supports splitting a single
--              sales order across multiple warehouses (partial fulfillment).
-- Depends on: 011_sales_orders.sql, 012_warehouses_inventory.sql

CREATE TABLE fulfillments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id  UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    scheduled_date  DATE,
    fulfilled_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fulfillments_status CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    )
);
CREATE INDEX idx_fulfillments_sales_order_id ON fulfillments(sales_order_id);
CREATE INDEX idx_fulfillments_warehouse_id ON fulfillments(warehouse_id);
CREATE INDEX idx_fulfillments_status ON fulfillments(status);
CREATE TRIGGER trg_fulfillments_updated_at
    BEFORE UPDATE ON fulfillments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fulfillment_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id        UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
    sales_order_item_id   UUID NOT NULL REFERENCES sales_order_items(id) ON DELETE RESTRICT,
    quantity              NUMERIC(12,2) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fulfillment_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_fulfillment_items_status CHECK (
        status IN ('PENDING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    )
);
CREATE INDEX idx_fulfillment_items_fulfillment_id ON fulfillment_items(fulfillment_id);
CREATE INDEX idx_fulfillment_items_sales_order_item_id ON fulfillment_items(sales_order_item_id);
CREATE TRIGGER trg_fulfillment_items_updated_at
    BEFORE UPDATE ON fulfillment_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
