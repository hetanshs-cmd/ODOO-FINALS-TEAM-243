-- Migration: 002_extensions_and_helpers.sql
-- Description: Required PostgreSQL extensions and shared helper objects
--              used by every subsequent migration.
--
-- RULES:
--   1. Never modify an already-applied migration.
--   2. New changes always go in new numbered migration files.
--   3. Run migrations in numeric order.
--   4. Always add NOT NULL, UNIQUE, CHECK, FK constraints explicitly.
--   5. Always index FK columns and frequent WHERE/JOIN columns.

-- gen_random_uuid() — used as the default for every primary key.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CITEXT — case-insensitive text, used for email columns so
-- "User@Example.com" and "user@example.com" are treated as the same
-- identifier for uniqueness/login purposes.
CREATE EXTENSION IF NOT EXISTS citext;

-- Shared trigger function: keeps `updated_at` current on every UPDATE
-- without requiring application code to set it manually.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
