-- Migration: 030_quotation_title.sql
-- Description: Adds an optional human-friendly title (proposal name) to a
--              quotation, distinct from the system-generated
--              quotation_number. Sales reps name a proposal something
--              meaningful ("Meridian Q4 Plant Automation") while the
--              quotation_number stays the immutable reference id.
--
-- Nullable and free of any money math, so it does not touch the
-- quotation_totals / quotation_item_amounts views.
-- Depends on: 006_quotations.sql

ALTER TABLE quotations
    ADD COLUMN title VARCHAR(200);
