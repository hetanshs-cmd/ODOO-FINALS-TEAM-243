-- Migration: 001_initial_schema.sql
-- Description: Placeholder initial migration.
--              Real tables will be added after Phase 0 analysis.
--
-- Run with: npm run migrate
--
-- RULES:
--   1. Never modify an already-applied migration.
--   2. New changes always go in new numbered migration files.
--   3. Run migrations in numeric order.
--   4. Always add NOT NULL, UNIQUE, CHECK, FK constraints explicitly.
--   5. Always index FK columns and frequent WHERE/JOIN columns.

-- ── Migration Tracking Table ──────────────────────────────────────────────────
-- This table records which migrations have been applied.
-- The migrate script uses this to skip already-applied migrations.

CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Example future migration structure ───────────────────────────────────────
-- (Uncomment and modify when problem statement is received)
--
-- CREATE TABLE users (
--     id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
--     email       VARCHAR(255) NOT NULL UNIQUE,
--     password    VARCHAR(255) NOT NULL,        -- bcrypt hash only
--     name        VARCHAR(100) NOT NULL,
--     role        VARCHAR(50)  NOT NULL DEFAULT 'user',
--     created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
--     updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
-- );
--
-- CREATE INDEX idx_users_email ON users(email);
-- CREATE INDEX idx_users_role  ON users(role);
