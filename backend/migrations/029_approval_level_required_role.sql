-- Migration: 029_approval_level_required_role.sql
-- Description: Binds each approval level to the staff role that may action a
--              request at that level, so the CURRENT step controls who may
--              act instead of "any manager can approve anything".
--
-- Before this, approval_requests.assigned_to (a specific user, usually null)
-- was the ONLY authorization gate in approvals.service.act, and the route
-- only admitted SALES_MANAGER/ADMIN — so a Sales Manager could approve a
-- FINANCE_APPROVAL request, and a real FINANCE user was refused at the route
-- entirely. required_role makes the level -> role mapping explicit and
-- admin-configurable, matching the SALES_MANAGER_APPROVAL / FINANCE_APPROVAL
-- / EXECUTIVE_APPROVAL levels seeded in 022.

ALTER TABLE approval_levels
    ADD COLUMN required_role VARCHAR(20) NOT NULL DEFAULT 'SALES_MANAGER'
        REFERENCES roles(name) ON UPDATE CASCADE;

-- Map the reference levels seeded in 022 to their owning role. EXECUTIVE_APPROVAL
-- has no dedicated role in the RBAC set (003_rbac.sql), so it lands on ADMIN,
-- who is the intended final-escalation actor.
UPDATE approval_levels SET required_role = 'SALES_MANAGER' WHERE name = 'SALES_MANAGER_APPROVAL';
UPDATE approval_levels SET required_role = 'FINANCE'       WHERE name = 'FINANCE_APPROVAL';
UPDATE approval_levels SET required_role = 'ADMIN'         WHERE name = 'EXECUTIVE_APPROVAL';

-- The DEFAULT stays: a level created without an explicit role falls back to
-- the first-line approver (SALES_MANAGER), matching level 1's semantics. The
-- admin approval-levels API accepts required_role so it can be set properly.
