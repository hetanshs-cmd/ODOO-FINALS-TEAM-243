-- Migration: 017_subscriptions.sql
-- Description: Subscription plans, active subscriptions, and their items —
--              the recurring/hybrid billing counterpart to sales orders.
-- Depends on: 004_customers.sql, 011_sales_orders.sql, 006_quotations.sql, 005_products.sql

CREATE TABLE subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150) NOT NULL UNIQUE,
    description         TEXT,
    billing_frequency   VARCHAR(20) NOT NULL,
    price               NUMERIC(14,2) NOT NULL,
    trial_days          INTEGER NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_subscription_plans_frequency CHECK (billing_frequency IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    CONSTRAINT chk_subscription_plans_price CHECK (price >= 0),
    CONSTRAINT chk_subscription_plans_trial_days CHECK (trial_days >= 0),
    CONSTRAINT chk_subscription_plans_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- sales_order_id / quotation_id nullable: a subscription may originate from
-- a converted quotation/order, or be created directly (e.g. self-serve).
CREATE TABLE subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id        UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    quotation_id          UUID REFERENCES quotations(id) ON DELETE SET NULL,
    plan_id               UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    start_date            DATE NOT NULL,
    end_date              DATE,
    next_billing_date     DATE,
    current_price         NUMERIC(14,2) NOT NULL,
    CONSTRAINT chk_subscriptions_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'MODIFIED')),
    CONSTRAINT chk_subscriptions_current_price CHECK (current_price >= 0),
    CONSTRAINT chk_subscriptions_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_sales_order_id ON subscriptions(sales_order_id);
CREATE INDEX idx_subscriptions_quotation_id ON subscriptions(quotation_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);

CREATE TABLE subscription_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity          NUMERIC(12,2) NOT NULL,
    unit_price        NUMERIC(14,2) NOT NULL,
    CONSTRAINT chk_subscription_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_subscription_items_unit_price CHECK (unit_price >= 0)
);
CREATE INDEX idx_subscription_items_subscription_id ON subscription_items(subscription_id);
CREATE INDEX idx_subscription_items_product_id ON subscription_items(product_id);
