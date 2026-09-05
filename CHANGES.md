# Recent Changes — Production Readiness Pass (2026-09-05)

> Companion to [`CODEBASE_AUDIT.md`](CODEBASE_AUDIT.md), which has the full forensic detail.
> This file is the short version: what changed, why, and what to do next — written for
> whoever picks this branch up after this session.

## Context: three passes, in order

1. **Forensic audit** — read-only, produced the original `CODEBASE_AUDIT.md` (§1–§33):
   2 P0s and 12 P1s found across backend logic, security, and concurrency. No code touched.
2. **Backend remediation pass** — fixed the P0/P1s from (1): quote-to-cash dead end
   (no endpoint ever transitioned a quotation to `ACCEPTED`), an auth config bypass, a
   compound discount-scope bug, several TOCTOU races, and more. Documented in
   `CODEBASE_AUDIT.md` §1a. Mid-pass, a teammate's independent schema-minimization
   refactor (`fe6d88d`) landed on `dev` — its own commit message says "application code
   has not been updated to match this schema yet." That reconciliation was explicitly
   deferred to a later pass rather than rushed; §9.2 of the audit documents exactly what
   was left broken and where.
3. **This pass — schema reconciliation** — closed every gap from (2)'s deferral, plus
   found and fixed several breakages the schema refactor caused that the audit had missed
   entirely (see below). Documented in `CODEBASE_AUDIT.md`'s appended **FINAL PRODUCTION
   AUDIT** section, which is the current source of truth on status — read that section
   before assuming anything in the earlier numbered sections still applies to the database
   layer.

## What the schema refactor actually changed

Commit `fe6d88d` ("refactor(db): minimize schema to remove dead columns and stored
redundancy"):
- Dropped the `customer_users` junction table in favor of `users.customer_id`.
- Renamed `approval_requests.approval_level` → `approval_level_id`.
- Removed **every stored money total** on `quotations`, `sales_orders`, `invoices`, and
  their line-item tables (`subtotal`, `discount_total`, `tax_total`, `grand_total`,
  `total`, `line_total`, `discount_amount`, `tax`) — replaced with six read-only views:
  `quotation_item_amounts`, `quotation_totals`, `sales_order_item_amounts`,
  `sales_order_totals`, `invoice_item_amounts`, `invoice_totals`. Look at these views'
  SQL (in `backend/migrations/006_quotations.sql`, `011_sales_orders.sql`,
  `015_billing_invoices.sql`) before touching any money math — they are the single
  source of truth now, not something to recompute in a service.
- Removed `sales_order_items.backordered_quantity` (the `backorders` table is now the
  sole record of that quantity).
- Added `tax_percent` to `sales_order_items`/`invoice_items`.

## What this pass fixed

Every fix below is a **reconciliation to the new schema**, not a business-logic change —
see `CODEBASE_AUDIT.md`'s "Business Logic Changes" section for the explicit statement of
that boundary.

| Area | What was broken | Fix |
|---|---|---|
| Portal login | `auth.repository.ts` still queried the dropped `customer_users` table — every portal magic-link request would throw | Query `users.customer_id` directly |
| Quotations | `quotation_items` INSERT referenced dropped columns; `quotations.repository.ts::recalculateTotals` UPDATEd columns that no longer exist | Insert raw inputs only, read computed amounts back from the views; deleted the dead recalculate method |
| Sales orders | Same pattern — INSERT/SELECT referenced dropped columns | Reconciled the same way; `convertFromQuotation` now reads the new order's totals from `sales_order_totals` after inserting its items |
| Negotiations | Counter-offer flow wrote to dropped columns and called a UPDATE that no longer exists | Only writes `discount_percent`; removed the dead recalculate step |
| Billing/invoices | `invoices`/`invoice_items` INSERTs referenced dropped columns entirely | Insert raw inputs, read totals back from `invoice_totals`; since invoices track no discount column, the quotation-line discount is netted into `invoice_items.unit_price` at billing time (documented in code) |
| **Customer portal** (missed by the original audit) | `portal.repository.ts`'s six methods did `SELECT *` on the bare tables — every customer-facing quotation/invoice view would silently return money fields as `undefined`, no error | All six rewritten to join the totals views |
| **Fulfillment/backorders** (missed by the original audit) | Two `UPDATE sales_order_items SET backordered_quantity = ...` statements referenced a dropped column — would throw on every partial allocation and every backorder consolidation | Deleted (the `backorders` table already has that record) |
| **Payments overpayment guard** (missed by the original audit — the most severe finding of this pass) | `payments.service.ts` read `invoice.total`, now `undefined` → `NaN` → `amount > NaN` is always `false` → **the overpayment check was silently disabled** | Joined `invoice_totals` into every invoice read in `billing.repository.ts` |
| Approvals API contract | The `approval_level` → `approval_level_id` rename broke `ApprovalsPages.tsx`, which has always read `approval_level` expecting the level's **name** (a pre-existing bug, since even before the refactor that field held a UUID) | Repository now joins `approval_levels` and returns both `approval_level_id` (internal) and `approval_level` (the name, for the API contract) |
| Approval-request race (DB-1) | No DB constraint stopped two concurrent code paths (discount-engine re-check vs. approval escalation — they lock *different* rows) from each creating a PENDING request for the same quotation | New migration `026`: partial unique index `(quotation_id) WHERE status = 'PENDING'`, with the resulting 409 handled gracefully in both call sites |
| CI | Frontend job called `npm run typecheck` and `npm run format:check`, neither of which existed | Added a `typecheck` script alias to `frontend/package.json` (`CONTRIBUTING.md`'s own pre-commit checklist already assumed this script existed); removed the `format:check` step since no formatter is configured for frontend at all — adding one is a team decision, not a CI-repair task |

## What's still open

- **Nothing in this pass was verified against a live database.** No working Postgres
  credentials were available in the environment this was done in (a native Windows
  Postgres service was found but not accessible; Docker was unavailable). Every fix here
  is correct by inspection against the migration source, not by running it. **Before
  trusting any of this in production: stand up a disposable Postgres, run `npm run
  migrate` from empty, and run the full integration suite** — including the new
  `backend/tests/integration/approvalRequestUniqueness.test.ts`, which proves the DB-1
  constraint but has never actually been executed.
- Backend `npm run format:check` fails on 53 files, unrelated to this pass (confirmed —
  files never touched here, like `crudRouter.ts`, are in the list). This has likely been
  failing on `dev` for a while. Someone should run `npm run format` once, review the diff,
  and commit it separately from any functional change.
- Frontend was not re-audited beyond the one contract fix above. The original audit's
  frontend findings (§7) may still be open.
- `docs/database.md`, `docs/api.md`, `docs/architecture.md`, `docs/references.md`, and
  `database/schema/er-diagram.md` were updated to remove stale `customer_users`
  references and the ER diagram's stored-totals claims, but the ER diagram's per-table
  `created_at`/`updated_at` listings were not exhaustively corrected for every table the
  refactor touched — a note at the top of that file points to the migrations as the
  source of truth instead.

## Where to look

- `CODEBASE_AUDIT.md` → **FINAL PRODUCTION AUDIT** section (bottom of the file) — full
  detail, a database-reconciliation table with old schema/new schema/fix for every call
  site, and the Production Readiness Gate.
- `backend/migrations/025_restore_app_compatible_timestamps.sql` and
  `026_approval_requests_one_pending_per_quotation.sql` — the two migrations this
  overall effort added, both purely additive.
- Verified locally: `cd backend && npx tsc --noEmit` (clean), `npx vitest run --exclude
  "tests/integration/**"` (165/165 passing), `npm run lint` (clean). `cd frontend && npm
  run lint` (clean) and `npm run build` (succeeds).
