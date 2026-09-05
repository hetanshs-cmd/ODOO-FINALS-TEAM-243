-- Migration: 004_customers.sql
-- Description: Customer tiers, customers, customer portal users, and addresses.
-- Depends on: 003_rbac.sql (users)

CREATE TABLE customer_tiers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(50)  NOT NULL UNIQUE,
    description    TEXT,
    discount_limit NUMERIC(5,2) NOT NULL,
    priority       INTEGER      NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_tiers_discount_limit CHECK (discount_limit >= 0 AND discount_limit <= 100),
    CONSTRAINT chk_customer_tiers_priority CHECK (priority >= 0),
    CONSTRAINT chk_customer_tiers_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE TRIGGER trg_customer_tiers_updated_at
    BEFORE UPDATE ON customer_tiers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- customer_tier_id: RESTRICT — a tier that customers depend on for their
-- discount governance must not be deletable out from under them.
CREATE TABLE customers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name      VARCHAR(200) NOT NULL,
    customer_code     VARCHAR(50)  NOT NULL UNIQUE,
    customer_tier_id  UUID         NOT NULL REFERENCES customer_tiers(id) ON DELETE RESTRICT,
    industry          VARCHAR(100),
    tax_id            VARCHAR(50),
    email             CITEXT,
    phone             VARCHAR(30),
    website           VARCHAR(255),
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_customers_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);
CREATE INDEX idx_customers_customer_tier_id ON customers(customer_tier_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- customer_users: the tenant-isolation join table for the customer portal.
-- A customer_user's `customer_id` is the scoping key the backend authorization
-- layer must filter every customer-portal query by.
CREATE TABLE customer_users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    designation  VARCHAR(100),
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_users UNIQUE (customer_id, user_id),
    CONSTRAINT chk_customer_users_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE INDEX idx_customer_users_customer_id ON customer_users(customer_id);
CREATE INDEX idx_customer_users_user_id ON customer_users(user_id);
CREATE TRIGGER trg_customer_users_updated_at
    BEFORE UPDATE ON customer_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type            VARCHAR(20)  NOT NULL,
    address_line_1  VARCHAR(255) NOT NULL,
    address_line_2  VARCHAR(255),
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100) NOT NULL,
    country         VARCHAR(100) NOT NULL,
    postal_code     VARCHAR(20)  NOT NULL,
    is_default      BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_addresses_type CHECK (type IN ('BILLING', 'SHIPPING', 'OFFICE'))
);
CREATE INDEX idx_addresses_customer_id ON addresses(customer_id);
CREATE INDEX idx_addresses_type ON addresses(type);
CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
