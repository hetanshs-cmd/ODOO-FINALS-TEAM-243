-- Migration: 026_approval_requests_one_pending_per_quotation.sql
-- Description: Resolves CODEBASE_AUDIT.md's DB-1 — enforces at the database
--              level the invariant the application already assumes: a
--              quotation has at most one PENDING approval request at a time.
--
-- discount-engine.service.ts's checkDiscounts() already cancels any stale
-- PENDING request (supersedePendingApprovalRequests) before raising a new
-- one, and does so under a lock on the quotation row. approvals.service.ts's
-- act() escalates a request (PENDING -> ESCALATED) and raises the next one
-- under a lock on the approval_requests row instead. Those two paths lock
-- different rows, so a checkDiscounts() call and an act()-triggered
-- escalation on the same quotation can interleave without either seeing the
-- other's write — each can independently conclude "no PENDING request
-- exists yet" and insert one, leaving two live PENDING requests for one
-- quotation. A partial unique index closes that gap as the final backstop,
-- independent of which code path raced: the second insert fails with 23505,
-- which mapDbError (shared/crud/dbErrors.ts) already turns into a clean 409
-- rather than a raw 500.
CREATE UNIQUE INDEX uq_approval_requests_one_pending_per_quotation
    ON approval_requests (quotation_id)
    WHERE status = 'PENDING';
