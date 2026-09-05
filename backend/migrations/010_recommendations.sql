-- Migration: 010_recommendations.sql
-- Description: Upsell / cross-sell recommendation rules between products.
-- Depends on: 005_products.sql

CREATE TABLE recommendation_rules (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommended_product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommendation_type      VARCHAR(20) NOT NULL,
    priority                 INTEGER NOT NULL DEFAULT 0,
    reason                   TEXT,
    status                   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_recommendation_rules_type CHECK (recommendation_type IN ('UPSELL', 'CROSS_SELL')),
    CONSTRAINT chk_recommendation_rules_priority CHECK (priority >= 0),
    CONSTRAINT chk_recommendation_rules_not_self CHECK (source_product_id <> recommended_product_id),
    CONSTRAINT uq_recommendation_rules UNIQUE (source_product_id, recommended_product_id, recommendation_type),
    CONSTRAINT chk_recommendation_rules_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
CREATE INDEX idx_recommendation_rules_source_product_id ON recommendation_rules(source_product_id);
CREATE INDEX idx_recommendation_rules_recommended_product_id ON recommendation_rules(recommended_product_id);
