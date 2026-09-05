# Backend Gaps — Living Checklist

Tracks what remains undone from the full move-business-logic-to-backend plan
(Phases A–H), as of the end of the `backend` branch's Phases A–F work. Update
this file at the end of each further phase rather than letting it go stale.

## Explicitly out of scope (product decisions, not backend gaps)

- **Multi-step approval escalation.** Only single-level approval routing
  exists (`approvals.service.ts`'s `ESCALATED` action creates one follow-up
  request at the next configured level — there is no chain/workflow engine).
  Decision: single-level routing is sufficient; do not build escalation
  chains. Frontend dependency: `ApprovalsPages.tsx` should only ever expect
  a single next-level escalation target, not a multi-hop chain.
- **Reporting-config server persistence.** `AdminReportingConfigPage` (frontend)
  keeps its config in `localStorage`; no backend module or table backs it.
  Decision: stays client-side. Frontend dependency: `AdminReportingConfigPage`.
- **Addresses management.** The `addresses` table (`004_customers.sql`) exists
  but nothing reads or writes it — no UI, no endpoint. Decision: out of
  scope, nothing consumes it. No frontend page depends on it today.

## Phase A–F status (this branch)

All of Phases A–F from the plan are implemented and tested (`npm run
typecheck && npm run build && npm test` pass; 129 tests). Notable judgment
calls made along the way:

- **`POST /quotations/:id/submit` is new, not in the original plan text.**
  The plan assumed a `DRAFT -> SUBMITTED` transition already existed
  somewhere and just needed the discount-engine wired to fire on it — a
  repo-wide search confirmed no code path ever set `SUBMITTED` before this
  change. Added the transition itself (repository `updateStatus` +
  service `submit` + route) as the natural place to auto-invoke
  `discountEngineService.checkDiscounts`. Frontend `QuotationDetailPage`
  should call this new endpoint instead of assuming submission happens
  implicitly.
- **Did not auto-run `checkDiscounts` on every DRAFT line-item mutation**
  (the plan's "consider... if it fits without much complexity" item for
  `addItem`). Reasoning: `checkDiscounts` can move status away from
  `DRAFT` (to `APPROVED`/`PENDING_APPROVAL`), which would make `addItem`'s
  own DRAFT-only guard immediately block further edits — an awkward UX
  regression for something explicitly marked optional. `addItem` does still
  refresh the deal-health score on every mutation, per the plan's
  deal-health requirement. Submit is the one path that runs governance
  automatically, matching the plan's stated priority ("correctness on
  submit is the priority").
- **`negotiations.service.ts` does not call `dealHealthService.recalculate`
  directly** — it calls `discountEngineService.checkDiscounts`, which
  (per this branch's Phase A wiring) already recalculates deal-health
  internally as its own post-commit step. Adding a second explicit call
  from negotiations would just be a redundant duplicate recalculation.
- **`025_products_cost_price.sql` was not created.** `products.cost_price`
  already existed (added in `005_products.sql`, already used by
  `upsell.repository.ts`'s margin calculation) — the plan's premise that it
  needed adding was stale, similar to the subscriptions-module correction
  already noted in the plan itself. `quotations.service.ts` now computes a
  null-safe `margin_percent` per quotation item from this existing column;
  no migration was needed.
- **Fulfillment audit-log entries use `actorId: null`.** `fulfillmentService.ship`
  doesn't currently receive an authenticated user id through its call chain
  (the controller doesn't thread one through); logging `null` matches
  `audit_logs.user_id`'s nullable, `ON DELETE SET NULL` design rather than
  guessing an actor. A future pass wiring `req.user.id` through
  `fulfillmentService.ship`/`acceptSplit`/`overrideSplit` would let these
  entries carry a real actor.
- **`backorders.consolidate` requires one warehouse to fully cover the
  remaining quantity.** A partial consolidation (covering some but not all
  of a backorder from one warehouse, or splitting across two) is not
  implemented — it 422s and leaves the backorder open for a later retry
  instead of under-shipping it silently. If partial consolidation turns out
  to be needed, `backordersService.consolidate` is the place to extend.
- **`fulfillments.override-split` only adjusts quantities on lines already
  part of a fulfillment.** Moving a line to a *different* warehouse (as
  opposed to changing its quantity within the current warehouse) isn't
  supported — the plan's "override: manually adjust which warehouse(s)...
  fulfill the order" phrasing could be read either way; this implementation
  took the narrower, lower-risk reading. Re-allocating to a different
  warehouse today means cancelling and re-running `suggest-fulfillment`.
- **Phase E (admin config overlap) confirmed all three suspected
  duplications and required no new code:**
  - "Upsell rules" = `admin/recommendation-rules.ts` CRUD (`RecommendationRule`
    fields — `source_product_id`/`recommended_product_id`/`recommendation_type`/
    `priority`/`reason`/`status` — match 1:1). Frontend `AdminUpsellRulesPage`
    should point at `/admin/recommendation-rules`, not a new endpoint.
  - "Approval rule config" = `admin/approval-levels.ts` CRUD (`name`/`level`/
    `description`). No separate concept exists.
  - "Discount tiers" = `admin/discount-rules.ts` CRUD. The 5 dead columns
    (`min_discount`, `approval_required`, `approval_level`, `sales_role`,
    `priority`) stay writable via this CRUD but are now documented in code
    (`admin/discount-rules.ts` and `discount-engine/discountEngine.ts`) as
    reserved/unused by the evaluation engine — a deliberate decision.
- **Docker/DB state**: `odoo_hackathon_db` (docker-compose Postgres) was
  already running at the start of this work and was left running. Migration
  `024_credit_notes.sql` was applied against it and the full test suite
  (unit + integration, including the new portal tenant-isolation test) was
  run against it successfully.

## Not started (later phases, not this branch's scope)

- **Phase G — frontend page migration off `dealStore`.** None of it is done;
  it's frontend-branch work. All of the Group 0–6 pages listed in the
  original plan still read/mutate through the mock store. See
  [`docs/dealstore-migration.md`](dealstore-migration.md) for the full
  per-file consumer catalog, migration-difficulty verdicts, and the open
  decision on features with no backend equivalent yet. In particular:
  - `useCustomers`/`useUsers` hooks (Group 0) can now be built against this
    branch's new `GET /customers` / `GET /users` endpoints.
  - `FulfillmentPages` detail view (Group 2) can now be built against
    `accept-split`/`override-split`/backorders endpoints from this branch.
  - `InvoicesPages` detail view (Group 2) can now use the new
    `GET /quotations/:id/timeline` endpoint.
  - `SubscriptionsPages` (Group 2) can now use `GET /subscriptions`,
    `GET /subscriptions/:id`, and the credit-notes endpoints.
  - `DealHealthPage` (Group 2) benefits from Phase A's auto-recalculation —
    scores should no longer go stale between manual recalculate calls.
  - `CustomerPortalPages` (Group 5) can now be built against this branch's
    new `/portal/quotations` and `/portal/invoices` endpoints.
- **Phase H — role-switcher removal and `dealStore.ts` deletion.** Not
  started; frontend-branch work, gated on Phase G completing first per the
  plan's own ordering.

## Verification state at end of this work

- `npm run typecheck && npm run build && npm test`: all pass (129 tests
  across unit + integration suites).
- Migration `024_credit_notes.sql` applied cleanly against the running
  docker-compose Postgres instance (`npm run migrate`), left running.
- Portal tenant isolation is verified with a real HTTP + real DB integration
  test (`tests/integration/portal-resources.test.ts`), not just asserted.
