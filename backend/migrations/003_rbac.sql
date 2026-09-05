-- Migration: 003_rbac.sql
-- Description: Role-based access control — roles, permissions,
--              role_permissions, and the users table.
-- Depends on: 002_extensions_and_helpers.sql

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT,
    CONSTRAINT chk_roles_name CHECK (
        name IN ('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'OPERATIONS', 'CUSTOMER', 'ADMIN')
    )
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- Pure junction: the (role_id, permission_id) pair is the identity, so it is
-- the primary key — no surrogate id, no timestamps.
CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Users: email uses CITEXT so uniqueness/login is case-insensitive.
-- customer_id is the customer-portal tenant key: NULL for internal staff, set
-- for portal users (role CUSTOMER) to the customer whose data they may see.
-- Its FK is added in 004_customers.sql, once `customers` exists.
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(150) NOT NULL,
    email          CITEXT       NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(30),
    role_id        UUID         NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    customer_id    UUID,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ,
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
