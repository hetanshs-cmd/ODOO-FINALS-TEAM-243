-- Migration: 022_seed_reference_data.sql
-- Description: Essential reference data the application cannot function
--              correctly without (RBAC roles, customer tiers, approval
--              levels). Idempotent via ON CONFLICT DO NOTHING.
--              No fake business transactions are seeded here.
-- Depends on: 003_rbac.sql, 004_customers.sql, 008_approvals.sql

INSERT INTO roles (name, description) VALUES
    ('SALES_REP',     'Creates quotations and negotiates with customers'),
    ('SALES_MANAGER', 'Approves discounts and escalations beyond sales rep authority'),
    ('FINANCE',       'Manages invoicing, payments, and billing'),
    ('OPERATIONS',    'Manages warehouses, inventory, and fulfillment'),
    ('CUSTOMER',      'External customer portal user'),
    ('ADMIN',         'Full system access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO customer_tiers (name, description, discount_limit, priority, status) VALUES
    ('BRONZE',   'Entry-level tier',        5,  1, 'ACTIVE'),
    ('SILVER',   'Mid-tier customers',      10, 2, 'ACTIVE'),
    ('GOLD',     'High-value customers',    20, 3, 'ACTIVE'),
    ('PLATINUM', 'Strategic accounts',      30, 4, 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

INSERT INTO approval_levels (name, level, description) VALUES
    ('SALES_MANAGER_APPROVAL', 1, 'First-level approval for discounts exceeding sales rep authority'),
    ('FINANCE_APPROVAL',       2, 'Second-level approval for high-value or high-risk deals'),
    ('EXECUTIVE_APPROVAL',     3, 'Final escalation level for exceptional discount requests')
ON CONFLICT (name) DO NOTHING;
