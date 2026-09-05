-- Migration: 007_discount_engine.sql
-- Description: Discount governance rules and their evaluation history.
-- Depends on: 005_products.sql, 004_customers.sql, 006_quotations.sql

-- product_id / category_id / customer_tier_id are all nullable so a rule can
-- be scoped at any single level (product-specific, category-wide, tier-wide,
-- or global when all three are NULL). SET NULL on delete: removing the
-- scoping product/category/tier degrades the rule toward global scope
-- instead of blocking deletion of that master record.
CREATE TABLE discount_rules (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(150) NOT NULL,
    priority           INTEGER NOT NULL DEFAULT 0,
    product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
    category_id        UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    customer_tier_id   UUID REFERENCES customer_tiers(id) ON DELETE SET NULL,
    sales_role         VARCHAR(50),
    min_discount       NUMERIC(5,2) NOT NULL,
    max_discount       NUMERIC(5,2) NOT NULL,
    approval_required  BOOLEAN NOT NULL DEFAULT false,
    approval_level     INTEGER,
    active             BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT chk_discount_rules_priority CHECK (priority >= 0),
    CONSTRAINT chk_discount_rules_min_discount CHECK (min_discount >= 0 AND min_discount <= 100),
    CONSTRAINT chk_discount_rules_max_discount CHECK (max_discount >= 0 AND max_discount <= 100),
    CONSTRAINT chk_discount_rules_range CHECK (max_discount >= min_discount)
);
CREATE INDEX idx_discount_rules_product_id ON discount_rules(product_id);
CREATE INDEX idx_discount_rules_category_id ON discount_rules(category_id);
CREATE INDEX idx_discount_rules_customer_tier_id ON discount_rules(customer_tier_id);
CREATE INDEX idx_discount_rules_active ON discount_rules(active);

-- discount_evaluations is an append-only history: every evaluation of a
-- requested discount is preserved (no updates, no upsert), so risk decisions
-- can be audited and re-evaluated after negotiation. evaluated_at is the
-- single timestamp — everything orders and filters by it.
CREATE TABLE discount_evaluations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id        UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    quotation_item_id   UUID REFERENCES quotation_items(id) ON DELETE CASCADE,
    requested_discount  NUMERIC(5,2) NOT NULL,
    allowed_discount    NUMERIC(5,2) NOT NULL,
    risk_score          NUMERIC(5,2) NOT NULL,
    risk_level          VARCHAR(20) NOT NULL,
    decision            VARCHAR(20) NOT NULL,
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_discount_evaluations_requested CHECK (requested_discount >= 0 AND requested_discount <= 100),
    CONSTRAINT chk_discount_evaluations_allowed CHECK (allowed_discount >= 0 AND allowed_discount <= 100),
    CONSTRAINT chk_discount_evaluations_risk_score CHECK (risk_score >= 0 AND risk_score <= 100),
    CONSTRAINT chk_discount_evaluations_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT chk_discount_evaluations_decision CHECK (decision IN ('AUTO_APPROVED', 'REQUIRES_APPROVAL', 'REJECTED'))
);
CREATE INDEX idx_discount_evaluations_quotation_id ON discount_evaluations(quotation_id);
CREATE INDEX idx_discount_evaluations_quotation_item_id ON discount_evaluations(quotation_item_id);
CREATE INDEX idx_discount_evaluations_decision ON discount_evaluations(decision);
CREATE INDEX idx_discount_evaluations_risk_level ON discount_evaluations(risk_level);
