-- Migration: 005_products.sql
-- Description: Product categories, products, price lists, and price list items.
-- Depends on: 004_customers.sql (customer_tiers)

CREATE TABLE product_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    parent_category_id  UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_product_categories_not_self CHECK (parent_category_id <> id)
);
CREATE INDEX idx_product_categories_parent_category_id ON product_categories(parent_category_id);

CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku          VARCHAR(50)  NOT NULL UNIQUE,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    category_id  UUID         NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
    product_type VARCHAR(20)  NOT NULL,
    base_price   NUMERIC(14,2) NOT NULL,
    cost_price   NUMERIC(14,2),
    unit         VARCHAR(20)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_products_base_price CHECK (base_price >= 0),
    CONSTRAINT chk_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT chk_products_type CHECK (product_type IN ('ONE_TIME', 'RECURRING')),
    CONSTRAINT chk_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED'))
);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- customer_tier_id nullable: a price list may apply globally (NULL) or be
-- scoped to a specific tier.
CREATE TABLE price_lists (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(150) NOT NULL,
    currency          VARCHAR(3)   NOT NULL,
    customer_tier_id  UUID REFERENCES customer_tiers(id) ON DELETE SET NULL,
    valid_from        DATE NOT NULL,
    valid_until       DATE,
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_price_lists_valid_range CHECK (valid_until IS NULL OR valid_until >= valid_from),
    CONSTRAINT chk_price_lists_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED'))
);
CREATE INDEX idx_price_lists_customer_tier_id ON price_lists(customer_tier_id);

CREATE TABLE price_list_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id  UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    price          NUMERIC(14,2) NOT NULL,
    min_quantity   INTEGER,
    max_quantity   INTEGER,
    CONSTRAINT uq_price_list_items UNIQUE (price_list_id, product_id),
    CONSTRAINT chk_price_list_items_price CHECK (price >= 0),
    CONSTRAINT chk_price_list_items_min_quantity CHECK (min_quantity IS NULL OR min_quantity > 0),
    CONSTRAINT chk_price_list_items_max_quantity CHECK (
        max_quantity IS NULL OR min_quantity IS NULL OR max_quantity >= min_quantity
    )
);
CREATE INDEX idx_price_list_items_price_list_id ON price_list_items(price_list_id);
CREATE INDEX idx_price_list_items_product_id ON price_list_items(product_id);
