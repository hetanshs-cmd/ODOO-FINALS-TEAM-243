-- Migration: 012_warehouses_inventory.sql
-- Description: Warehouses and per-warehouse product inventory, enabling
--              multi-warehouse fulfillment and reservation tracking.
-- Depends on: 004_customers.sql (addresses), 003_rbac.sql (users), 005_products.sql

CREATE TABLE warehouses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(150) NOT NULL,
    code         VARCHAR(50)  NOT NULL UNIQUE,
    address_id   UUID REFERENCES addresses(id) ON DELETE SET NULL,
    manager_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_warehouses_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE INDEX idx_warehouses_address_id ON warehouses(address_id);
CREATE INDEX idx_warehouses_manager_id ON warehouses(manager_id);

-- quantity_available is not stored: it is exactly
-- quantity_on_hand - quantity_reserved, so storing it would allow the two to
-- drift apart. Allocation computes it from the two columns under a row lock.
CREATE TABLE inventory (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id         UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id           UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_on_hand     NUMERIC(14,2) NOT NULL DEFAULT 0,
    quantity_reserved    NUMERIC(14,2) NOT NULL DEFAULT 0,
    reorder_level        NUMERIC(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_inventory_warehouse_product UNIQUE (warehouse_id, product_id),
    CONSTRAINT chk_inventory_on_hand CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_inventory_reserved CHECK (quantity_reserved >= 0),
    CONSTRAINT chk_inventory_reorder_level CHECK (reorder_level >= 0),
    CONSTRAINT chk_inventory_reserved_le_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
