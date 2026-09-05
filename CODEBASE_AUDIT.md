# CODEBASE AUDIT

**Repository:** `hetanshs-cmd/ODOO-FINALS-TEAM-243` — DealFlow360
**Branch audited:** `dev` @ `f1c5538`, then remediated in place; `dev` @ `bebd087` after a mid-pass
`git pull` brought in a teammate's schema refactor (see §9 update).
**Date:** 2026-09-05
**Mode:** Original pass was READ-ONLY. A second, active remediation pass followed (same day, this
document), fixing confirmed findings in source and adding one new migration — see §1a and §9.1.
**Auditor roles applied:** Principal Architect · Staff Full-Stack · DB Architect · Security · QA Lead · DevOps · Code Reviewer

## 1a. Remediation Pass Summary (same day, follow-up to the audit below)

Everything from §2 onward is the **original forensic audit**, left intact as the historical
record. This section summarizes what was subsequently fixed. Full details, file lists, and test
evidence are in the sections referenced.

**Fixed (backend, verified by `tsc --noEmit` + full unit suite, 165 tests passing):**
- **P0 AUD-001** — quote-to-cash dead end. Implemented `POST /portal/quotations/:id/confirm`
  (FR9, was entirely missing) and widened `convertFromQuotation`'s accepted statuses to
  `APPROVED`/`ACCEPTED`, closing the TOCTOU with a row lock. New tests:
  `sales-orders.test.ts`, `portal.service.test.ts`.
- **P0 AUD-002** — `NODE_ENV` no longer defaults to `development`; the portal magic-link
  `devToken` now requires an explicit `ALLOW_DEV_MAGIC_LINK=true` opt-in that the app refuses to
  combine with `NODE_ENV=production`.
- **P1 AUD-007 / LB-1** — discount-engine compound-scope bug: rewrote `resolveEffectiveCeiling`
  to require every scope a rule declares, with specificity + `priority` as tie-breaks, instead of
  OR-matching independently-scoped rules. New tests in `discountEngine.test.ts`.
- **P1 AUD-008** — `overrideSplit` validated inventory at an arbitrary warehouse; now locks and
  checks the fulfillment's own warehouse (`lockInventoryAtWarehouse`), and wraps the transaction
  in `mapDbError` so a constraint violation returns 422, not a raw 500.
  New/updated tests in `fulfillment.test.ts`.
- **P1 AUD-009 / LB-2** — `computeNextBillingDate` month-end overflow (Jan 31 → "Mar 3") fixed by
  clamping to the target month's actual length. 6 new regression tests in `billingDates.test.ts`.
- **P1 AUD-010 / LB-3** — subscription `quantity` no longer silently defaults to 1 on a plan-only
  PATCH; derived from `subscription_items` when omitted, refusing the request if none exist.
  Also fixed the subscription price-basis conflict and frequency-change `next_billing_date`
  re-basing (LB-4, LB-6). New tests in `subscriptions.test.ts`.
- **P1 AUD-014** — approvals: added the row lock the TOCTOU needed, enforced `assigned_to`
  segregation of duties (with an ADMIN override), and blocked a requester from approving their
  own request. New test file `approvals.test.ts` (this module had zero prior test coverage).
- **P1 AUD-013** (partial) — flagged in the plan; **not fixed this pass** (would require a
  frontend dependency swap, out of this pass's backend-only scope — see remaining risks).
- **P2 AUD-015** — closed the same TOCTOU pattern (unlocked read → separate write) in
  `discountEngineService.checkDiscounts`, `fulfillmentService.allocate`, and `ship`.
- **P2 AUD-018/030/031** — introduced `shared/postCommit.ts`: every non-essential post-transaction
  side effect (notifications, deal-health recalculation) is now caught and logged instead of
  turning a committed write into a client-visible 500. `submit` now rolls its status back to
  `DRAFT` if the subsequent discount check fails, instead of stranding the quotation in `SUBMITTED`.
- **P2 AUD-020 / LB-5** — `discountExceptions` now picks latest-evaluation-per-item *before*
  filtering to HIGH, so a renegotiated, now-compliant line leaves the report.
- **P2 AUD-032 / LB-9** — a new discount-check now cancels the quotation's prior `PENDING`
  approval request before/если raising a new one, so repeated counter-offers stop stacking
  duplicate approval-queue entries.
- **P2/P3** — `mapDbError` wrapping added to `billing.generateBillingForOrder`; `LB-11` (reporting
  date-range off-by-one) fixed; portal list queries capped at 500 rows pending a real pagination
  contract change; audit-log actor IDs threaded through fulfillment's `ship`/`acceptSplit`/
  `overrideSplit` (AUD-017); corrected two inaccurate code comments (AUD-016 turned out to be a
  **false positive** — admin CRUD already wrote `audit_logs` correctly; only the comments were stale).
- **Test-only correction**: none of the above required weakening the coverage gate — 4 new test
  files (`approvals.test.ts`, `sales-orders.test.ts`, `portal.service.test.ts`, plus expanded
  `discountEngine.test.ts`/`billingDates.test.ts`/`subscriptions.test.ts`/`fulfillment.test.ts`)
  were added specifically because the modules being fixed had weak or no prior coverage.

**Explicitly NOT done this pass (by scope, not oversight):**
- **AUD-003/004/006/012/013 (frontend)** and the **DB reconciliation in §9.2** were left
  untouched — the user scoped this pass to backend logic fixes and deferred DB/frontend
  reconciliation to a dedicated follow-up. See §9 for the full, newly-expanded DB section.
- A teammate's independent schema refactor (`fe6d88d`) was pulled mid-pass. Per explicit user
  decision, this pass did **not** attempt the large reconciliation it requires (§9.2) — only two
  narrow, additive, non-breaking fixes were made (§9.1) so that nothing already working was made
  worse. **§9.2's items are now the top-priority backend blockers**, ahead of everything else in
  §28's original plan, because they make several just-fixed code paths (including the P0 fix)
  unverifiable against the live schema until reconciled.

**Verification performed:** `npx tsc --noEmit` (backend) — clean. `npx vitest run --exclude
'tests/integration/**'` — 165/165 passing. Integration tests and any live-DB check remain
un-runnable on this machine (Docker unavailable), unchanged from the original audit's caveat.
**No git commits were made and nothing was pushed** — all changes are in the working tree only,
per explicit user instruction for this session.

---

## 1. Executive Summary

DealFlow360 is a genuinely ambitious, well-structured B2B quote-to-cash platform. The backend layering
(Route → Middleware → Controller → Service → Repository → Postgres) is consistent, the 24-migration
schema is unusually disciplined for a hackathon (CHECK constraints, FK delete-behaviour reasoning,
append-only audit tables), and the four pure algorithm modules (`discountEngine`, `warehouseAllocation`,
`dealHealth`, `creditNoteCalculator`) are properly isolated and unit-tested.

**It is not production-grade.** The audit found two P0 issues and twelve P1 issues. The two most
important findings are structural, not cosmetic:

1. **The core workflow is a dead end.** `POST /quotations/:id/convert` requires
   `quotation.status === 'ACCEPTED'`. Exhaustive search of every `UPDATE quotations SET status`
   statement in the backend shows **no code path anywhere writes `ACCEPTED`**. Sales orders,
   fulfillment, backorders, invoices, payments, subscriptions and credit notes — roughly half the
   backend — are unreachable through the API.

2. **The frontend has two sources of truth.** `store/dealStore.ts` (2,450 lines) is a complete
   client-side simulation seeded from `data/seedData.ts` (2,859 lines), persisted to `localStorage`,
   with **zero network calls**. Six pages were rewired to the real API; the rest — including every
   admin configuration page, the dashboard, deal-health and reports — still read the simulation.
   Discount ceilings and approval chains configured in the admin UI never reach the server.

Supporting this: **CI has failed on every run, including merges into `main`.** Backend coverage is
46.61% against a 70% gate, and the frontend CI job dies immediately on a missing `typecheck` script,
so the frontend is never typechecked, linted, or built by CI.

There is no Dockerfile, no deployment manifest, no scheduler, no structured logging, and no
monitoring. The application cannot currently be deployed, and if deployed would not function
end-to-end.

**Verdict: 🔴 NOT PRODUCTION READY.**

| | Count |
|---|---|
| CONFIRMED issues | 47 |
| LIKELY issues | 9 |
| SUSPECTED / requires verification | 6 |
| **Total** | **62** |

| Severity | Count |
|---|---|
| P0 — Critical | 2 |
| P1 — High | 12 |
| P2 — Medium | 21 |
| P3 — Low | 19 |
| P4 — Informational | 8 |

> **Verification caveat.** Docker is not installed on the audit machine, so no migration was executed
> against a live Postgres and no endpoint was invoked at runtime. Every finding below is derived from
> source, schema, and CI logs. Findings that require a running database to confirm are explicitly
> marked **LIKELY** or **SUSPECTED**.

---

## 2. Actual Project Purpose

| Aspect | Finding |
|---|---|
| **Name** | DealFlow360 |
| **Purpose** | Self-governing B2B sales platform: quotations auto-route for approval on tiered/categorical discount rules; fulfillment auto-splits across warehouses; billing handles one-time + recurring on one order; customers negotiate through an isolated portal that can silently re-trigger approval |
| **Target users** | Sales Rep, Sales Manager, Finance, Operations, Admin (internal) + Customer (portal) |
| **Core problem** | Discount governance without a manager manually watching every deal |
| **Documented requirements** | FR1–FR11 (`docs/requirements.md`, `README.md`) |

### Documentation vs implementation

**DOCUMENTED BUT NOT IMPLEMENTED (CONFIRMED)**

| Documented | Status |
|---|---|
| `POST /portal/quotations/:id/confirm` (FR9 — the headline re-approval loop) | Absent. `portal.routes.ts` is read-only (4 GETs). |
| `GET /api/v1/reports/export` (PDF/XLS) | No backend route. Frontend does client-side export via `jspdf`/`xlsx` instead. |
| `POST /api/v1/negotiations/:id/changes` | Absent; folded into `/messages` with `message_type=COUNTER_OFFER`. |
| `POST /portal/quotations/:id/negotiations/messages` | Absent; portal callers use `/api/v1/negotiations/:id/messages` via mixed auth. |
| "All admin writes go through `audit_logs`" (`docs/api.md:341`) | **False.** Zero `insertAuditLog` calls in `shared/crud/` or `modules/admin/`. |
| "final `APPROVE` triggers fulfillment suggestion" (`docs/api.md:403`) | Not implemented; `approvals.service.act` only updates statuses. |
| Recurring billing (FR7) | `billing_schedules` rows are inserted but **never read** — no consumer, no scheduler. |
| STALLED deal detection (FR10) | Detector exists but can never fire autonomously (no scheduler). |

**IMPLEMENTED DIFFERENTLY FROM DOCUMENTATION (CONFIRMED)**

| Documented | Actual |
|---|---|
| `GET /quotations/:id/recommendations` | `GET /products/:id/recommendations` |
| `GET /api/v1/reports` | `/reports/sales-summary` + `/reports/discount-exceptions` |
| Approval actions `APPROVE\|REJECT\|ESCALATE\|RETURN` | `APPROVED\|REJECTED\|ESCALATED\|COMMENTED\|CANCELLED`. `RETURN` does not exist (it is `CANCELLED`); a client following the docs gets HTTP 400. |
| Negotiation message types `COMMENT\|COUNTER_OFFER\|ACCEPTANCE\|REJECTION` | `TEXT\|COUNTER_OFFER` only (matches the DB CHECK; the docs do not). |
| `GET /api/v1/deal-health` = alerts **and** latest scores | Alerts only. |
| Signup wrong-role → `403 FORBIDDEN` (service) | Zod `z.literal('SALES_REP')` rejects first → `400 VALIDATION_ERROR`. The 403 branch is unreachable. |

**PARTIALLY IMPLEMENTED**: FR5 (upsell margin threshold is a caller-supplied query param, not a governed rule), FR10 (scoring implemented, alerting inert), FR11 (two fixed reports; documented period/team/status/product filters largely absent).

**DEAD / ABANDONED**: `docs/api.md` still opens with "⚠️ API endpoints will be defined during Phase 0 analysis. No endpoints are implemented." while documenting ~50 endpoints. `discount_rules.min_discount`, `.priority`, `.approval_required`, `.approval_level`, `.sales_role` are never read. `frontend/.env.example` documents `GEMINI_API_KEY`/`APP_URL` that no code reads.

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Node 22, Express 4.18, TypeScript 5.3 (`strict`, `noUncheckedIndexedAccess`) | CommonJS, `tsx` dev runner |
| DB | PostgreSQL 15, raw parameterized `pg` 8.11, no ORM | 24 SQL migrations, custom runner |
| Validation | Zod 3.22 via `middleware/validate.ts` | body/params/query |
| Auth | `jsonwebtoken` 9, `bcrypt` 5, dual-scope JWT (`internal` / `portal`) | |
| Security mw | `helmet` 7, `cors` 2.8, `express-rate-limit` 7 | |
| Backend tests | Vitest 5 + `supertest` 6, v8 coverage, 70% thresholds | |
| Frontend | React 19, Vite 6, React Router 7, Tailwind 4 | |
| FE libs | `recharts`, `lucide-react`, `motion`, `jspdf`, `xlsx` | |
| FE tests | **None** — no test runner, no test script | |
| CI | GitHub Actions: Quality Checks + Security Checks | **Both red on every run** |
| Infra | `docker-compose.yml` — Postgres only | **No app Dockerfile** |

`docs/technology-decisions.md` is honoured — no unapproved frameworks were introduced.

---

## 4. Repository Structure

```
ODOO/
├── backend/            207 tracked files
│   ├── migrations/     002–024 (001 intentionally deleted; runner sorts lexicographically — OK)
│   ├── scripts/        migrate.js, seed.js (seed is NODE_ENV=production guarded ✓)
│   └── src/
│       ├── config/     env.ts (Zod-validated), database.ts (pg Pool, max 20)
│       ├── middleware/ authenticate, authorize, validate, errorHandler, requestLogger, notFoundHandler
│       ├── errors/     AppError + Errors factory
│       ├── shared/     crud/ (generic factory), db/withTransaction, auditLog, money, documentNumber, approvalLevels
│       ├── utils/      jwt, response, pagination
│       └── modules/    20 modules (admin, approvals, auth, billing, credit-notes, customers,
│                       deal-health, discount-engine, fulfillment, negotiations, notifications,
│                       portal, quotations, reporting, sales-orders, subscriptions, upsell, users)
│   └── tests/          unit/ (12 files) + integration/ (4 files)
├── frontend/           122 tracked files
│   ├── src/store/      dealStore.ts — 2,450-line localStorage simulation ⚠️
│   ├── src/data/       seedData.ts — 2,859 lines of mock data ⚠️
│   ├── src/domain/     3,483 lines of business logic duplicated from the backend ⚠️
│   ├── src/services/   httpClient, tokenStore, authService, index.ts, apiTypes, ai/ (local adapter)
│   ├── src/hooks/      useAuth + 8 resource hooks
│   └── src/pages/      18 pages (6 API-backed, 12 simulation-backed)
├── docs/               13 documents
├── database/           README + er-diagram.md
└── docker-compose.yml  Postgres + Postgres-test only
```

### Suspicious / bloat inventory (reported, NOT removed)

| Item | Evidence | Class |
|---|---|---|
| `frontend/bun.lock` (90 KB) **and** `frontend/package-lock.json` (178 KB) | Both tracked; CI uses `npm ci` | Duplicate lockfile — nondeterministic installs |
| `frontend/src/data/seedData.ts` (82 KB) | Only consumer is `dealStore.ts` | Mock data in production bundle |
| `frontend/src/domain/tests/*.ts` (1,055 lines) | Hand-rolled assertions returning `TestResultItem[]`; no runner | Not real tests |
| `@google/genai` dependency | `grep` for `@google/genai\|GoogleGenAI\|GEMINI_API_KEY` in `frontend/src` → **0 hits** | Unused dependency |
| `express`, `dotenv` in frontend `dependencies` | No import anywhere in `frontend/src` | Unused; **source of the `qs`/`body-parser` CVE chain failing CI** |
| `vite` in **both** `dependencies` and `devDependencies` | `frontend/package.json` | Duplicate declaration |
| `frontend/package.json` `"name": "react-example"` | | Scaffold residue |
| `services/index.ts:465-480` `directoryService` | Calls `/customers/:id`, `/users/:id` — neither route exists | Dead code that always returns `null` |
| `domain/deal-health/config.ts` `repDiscountBaselines` | Hardcodes `'Sarah Chen'`, `'USR-REP-01'`, … | Demo data as production config |
| `docs/architectural-references`, `docs/dealflow360-schema-update`, `scaffold-init` branches | 10 / 4 / 4 commits "ahead" of `dev` but are pre-history snapshots | Stale branches; merging would regress the repo |

---

## 5. Architecture

### Actual request path

```
Browser (React 19 SPA)
   ├── [12 pages] ──► useDealStore ──► dealStore.ts ──► localStorage        ⚠️ NEVER REACHES SERVER
   └── [6 pages]  ──► hooks/use*.ts ──► services/index.ts ──► httpClient (fetch)
                                                                 │ Bearer from localStorage
                                                                 ▼
Express app.ts
   trust proxy(1) → helmet → cors(FRONTEND_URL) → rateLimit(100/15min GLOBAL)
   → express.json(10mb) → requestLogger
   → Router → authenticate | authenticatePortal → requireRole → validate(Zod)
   → Controller (parse/format only) → Service (business rules, withTransaction)
   → Repository (raw parameterized pg) → PostgreSQL 15
   → notFoundHandler → errorHandler (envelope, no stack leakage)
```

### Flows

- **Auth (internal):** `POST /auth/login` → bcrypt compare → `signInternalToken(id, role)` (`scope:'internal'`, 15m) → client `localStorage`. No refresh token despite `JWT_REFRESH_EXPIRY` being configured.
- **Auth (portal):** `POST /portal/request-link` → `crypto.randomBytes(32)` → **in-memory `Map`** → `POST /portal/verify-link` → `signPortalToken(users.id, customerId)` (`scope:'portal'`).
- **Authorization:** `requireRole(...)` on routers; row-level ownership in services (`assertCanAccessQuotation`, `portalCustomerId` checks). Portal reads are correctly scoped by `customer_id` in the SQL `WHERE` clause.
- **Error flow:** `AppError` → `errorHandler` → typed envelope. Unknown errors → generic 500, full detail logged server-side. **Correct — no stack traces leak.**
- **Transactions:** `withTransaction(fn)` on a dedicated `PoolClient`. Used for every multi-step write.
- **Background jobs / caching / uploads:** **none exist.**

### Architecture violations (CONFIRMED)

| # | Violation | Evidence |
|---|---|---|
| A1 | **Business logic duplicated in the UI** | `frontend/src/domain/` reimplements discounts, approvals, fulfillment, billing, deal-health, reporting — 3,483 lines paralleling the backend |
| A2 | **Two sources of truth** | `dealStore.ts` has zero network calls; 12 pages read it, 6 read the API |
| A3 | **Frontend trusted for security** | Admin configuration pages mutate `dealStore` only; server never sees the change |
| A4 | **Hidden global state** | `dealStore` module singleton + `localStorage`; `useAuth` is a hook, not a Context — every consumer holds independent state |
| A5 | **Documented module contract violated** | `shared/auditLog.ts` says "Always call this from inside the same `withTransaction` block"; `quotations.service.create` passes the pool (`db`) instead |
| A6 | **Inconsistent concurrency discipline** | `acceptSplit`/`overrideSplit`/`subscriptions.*`/`billing.generate` use `SELECT … FOR UPDATE`; `checkDiscounts`, `approvals.act`, `fulfillment.allocate`, `fulfillment.ship` do not |
| A7 | **Duplicated proration rule** | `subscriptions.service.prorateForCycle` and `creditNoteCalculator.calculateRefund` are near-identical, each with its own `CYCLE_DAYS`/`MS_PER_DAY` |

---

## 6. Major User Flows — Chain Trace

### Flow 1: Rep builds and submits a quotation — ⚠️ PARTIAL

```
UI QuotationsPages ──► useQuotations ──► POST /quotations
  ↓ authenticate + requireRole(SALES_REP,SALES_MANAGER,ADMIN) ✓
  ↓ Zod createQuotationSchema ✓
  ↓ sales_rep_id forced from req.user — never client-supplied ✓ (good)
  ↓ INSERT quotations ✓ · insertAuditLog(db, …) ⚠️ pool not transaction (A5)
  ↓ 201 { success, data, message } ✓
POST /quotations/:id/items
  ↓ status must be DRAFT ✓ · totals computed server-side, client line_total ignored ✓ (good)
  ↓ INSERT quotation_items → recalculateTotals ✓
  ↓ await dealHealthService.recalculate() ⚠️ outside any transaction; if it throws, the item is
    already committed but the caller sees 500 → retry duplicates the line (AUD-030)
POST /quotations/:id/submit
  ↓ TX: status DRAFT→SUBMITTED + audit ✓
  ↓ THEN separate call: discountEngineService.checkDiscounts()  ⚠️ different transaction
    → if it throws (e.g. "no approval levels configured"), quotation is stranded in SUBMITTED
      and the user sees 422 after a successful mutation (AUD-031)
  ↓ status → APPROVED (risk LOW) or PENDING_APPROVAL
```
**Mismatch found:** a `LOW`-risk quotation reaches `APPROVED` with **no `approval_requests` and no
`approval_actions` row**. FR3 permits a 0-step chain, but FR4 ("immutable audit log on every approval
action") then has no approval record — only a `DISCOUNT_CHECK` audit row.

### Flow 2: Manager approves — ⚠️ PARTIAL

```
GET /approvals ──► requireRole(SALES_REP,SALES_MANAGER,ADMIN); reps see only their own ✓
POST /approvals/:id/act ──► requireRole(SALES_MANAGER, ADMIN) ✓
  ↓ findById + status check  ⚠️ OUTSIDE the transaction (TOCTOU — AUD-014)
  ↓ TX: INSERT approval_actions → UPDATE approval_requests → UPDATE quotations → audit ✓
```
**Mismatches found:**
- `approval_requests.assigned_to` is **never set and never checked**. Any `SALES_MANAGER` can approve
  any request, including one escalated to a higher (Finance) level. The 2-step chain is cosmetic —
  the same person can approve both levels. **Segregation of duties is not enforced.**
- Docs promise `APPROVE` triggers fulfillment suggestion — it does not.
- Docs say action `RETURN`; the API accepts `CANCELLED`. Contract mismatch.

### Flow 3: Quotation → Sales Order — 🔴 **BROKEN (P0)**

```
POST /quotations/:id/convert
  ↓ CONVERTIBLE_STATUSES = Set(['ACCEPTED'])
  ↓ quotation.status is one of: DRAFT | SUBMITTED | PENDING_APPROVAL | APPROVED |
                                 REJECTED | NEGOTIATION | CONVERTED
  ↓ ACCEPTED is NEVER WRITTEN by any code path
  ↓ ALWAYS → 422 BUSINESS_RULE_VIOLATION
```
Everything downstream — `sales_orders`, `fulfillments`, `backorders`, `invoices`, `payments`,
`subscriptions`, `billing_schedules`, `credit_notes` — is unreachable. The frontend maps
`api.confirmQuotation → quotationService.convert`, so the portal "confirm" button also dead-ends.

### Flow 4: Customer negotiates — ⚠️ PARTIAL

Portal auth, tenant isolation and the `sender_user_id` FK are all **correct** (portal JWT `sub` is a
real `users.id`, verified in `auth.service.verifyMagicLink`). But each `COUNTER_OFFER` re-runs
`checkDiscounts`, which creates a **new** `approval_requests` row without cancelling the previous
`PENDING` one. There is no unique constraint on `(quotation_id, status='PENDING')`, so repeated
counter-offers accumulate duplicate pending approvals for one quotation.

### Flow 5: Recurring billing — 🔴 **INERT**

`billing_schedules` rows are inserted by `billing.service` and `subscriptions.service`. `grep` across
`backend/src` finds **no SELECT** against that table and **no scheduler** (`setInterval`, `node-cron`,
worker — zero hits). Recurring revenue is write-only.

### Flow 6: Admin configures discount ceilings — 🔴 **BROKEN**

`AdminDiscountTiersPage` imports `useDealStore`, not any service. A ceiling changed in the UI is
written to `localStorage` and never transmitted. The backend `/admin/discount-rules` endpoints exist
and work, but nothing calls them.

---

## 7. Frontend Audit

### Routing
- **CONFIRMED (P3):** `/portal/*` is wrapped in `<ProtectedRoute>` with no `requireInternal` and no
  `allowedRoles` — an internal user can navigate into the customer portal. Its API calls then 401
  (portal scope mismatch), producing a broken page rather than a data leak.
- **CONFIRMED (P2):** `/invoices`, `/subscriptions`, `/reports` carry no `allowedRoles`, but the
  backend restricts them to `FINANCE|SALES_MANAGER|ADMIN`. A `SALES_REP` navigates in successfully
  and receives 403s. Frontend and backend authorization models disagree.
- **CONFIRMED (P3):** `allowedRoles={['admin','Admin']}` — both normalize identically; redundant.
- **CONFIRMED (P4):** `/admin/price-lists`, `/admin/approval-chains`, `/admin/subscription-plans` are
  `<Navigate>` stubs to other pages — documented admin surfaces that do not exist.

### State
- **CONFIRMED (P1) AUD-012:** `useAuth` is a plain hook, **not** a Context provider. Each consumer
  gets independent `useState`. `logout()` clears the token but only resets the calling component's
  state — other mounted components keep `isAuthenticated: true`. `selectedTeam` and `setSessionUser`
  are per-component and never shared.
- **CONFIRMED (P2):** `const initial = hydrateFromToken();` runs on **every render** of every
  `useAuth` consumer (localStorage read + base64 decode + `JSON.parse`), though only the first render
  uses it.
- **CONFIRMED (P1):** **No 401 handling.** The backend JWT expires in 15 minutes. `httpClient` throws
  `ApiError(status 401)` but nothing globally clears the token or redirects to `/login`. After 15
  minutes an open tab shows generic errors on every action with no path to recovery.
- **CONFIRMED (P1) AUD-003:** dual state systems (see §5 A2).

### API
- **CONFIRMED (P2) AUD-022:** `directoryService.getCustomer` → `GET /customers/:id` and
  `getUser` → `GET /users/:id`. Neither route exists (`customersRouter`/`usersRouter` expose `GET /`
  only). Both are wrapped in `try { … } catch { return null; }`, so they fail **silently forever** —
  display names never resolve and no error surfaces.
- **CONFIRMED (P3):** Backend endpoints with no frontend consumer: `GET /backorders`,
  `GET /subscriptions`, `GET /credit-notes`, `GET /invoices`, `GET /negotiations`,
  `GET /portal/invoices`, `GET /portal/invoices/:id`.
- **CONFIRMED (P3):** `api.getStockLevels` returns `{ unavailable: true, reason }` — honest, but a
  documented FR6 surface with no backend.

### Forms / UI logic
- **CONFIRMED (P2):** No submit-in-flight guard observed in the shared hooks — double-clicking a
  submit button issues two POSTs. Combined with the backend TOCTOU races (§16) this produces
  duplicate quotations/approval actions.
- **CONFIRMED (P1):** UI rendered from `dealStore` does not represent database state at all. This
  fails acceptance criterion 8 ("Does the final UI represent the actual database state?") for 12 of
  18 pages.

### Performance / quality
- **CONFIRMED (P2):** Oversized modules — `dealStore.ts` 2,450 lines, `QuotationDetailPage.tsx` 1,726,
  `InvoicesPages.tsx` 1,689, `ApprovalsPages.tsx` 1,586, `LoginPage.tsx` 1,207.
- **CONFIRMED (P2):** `seedData.ts` (82 KB) + `dealStore.ts` (87 KB) + `domain/` (3,483 lines) ship
  in the production bundle.
- **CONFIRMED (P3):** Two different `AIInsightPanel.tsx` files (`components/ai/` and
  `components/domain/`) — duplicate components.

---

## 8. Backend Audit

### Endpoint matrix (auth / role / validation verified from source)

| Method | Path | Auth | Roles | Validated |
|---|---|---|---|---|
| GET | `/health` | none | — | — |
| POST | `/auth/login`, `/auth/signup` | none | — | Zod ✓ |
| POST | `/portal/request-link`, `/portal/verify-link` | none | — | Zod ✓ |
| * | `/admin/*` (10 resources) | internal | ADMIN | Zod ✓ |
| GET/POST/PATCH | `/quotations`, `/:id`, `/:id/items`, `/:id/submit`, `/:id/timeline` | internal | REP, MGR, ADMIN | Zod ✓ |
| POST | `/quotations/:id/check-discounts` | internal | REP, MGR, ADMIN | Zod ✓ |
| POST | `/quotations/:id/convert` | internal | REP, MGR, OPS, ADMIN | Zod ✓ |
| GET/POST | `/quotations/:id/negotiations` | internal **or** portal | none (row-level) | Zod ✓ |
| GET/POST | `/approvals`, `/:id`, `/:id/act` | internal | REP/MGR/ADMIN; act = MGR/ADMIN | Zod ✓ |
| GET | `/sales-orders`, `/:id` | internal | REP, MGR, OPS, ADMIN | Zod ✓ |
| POST/GET | `/sales-orders/:id/suggest-fulfillment`, `/:id/fulfillments` | internal | OPS, MGR, ADMIN | Zod ✓ |
| GET/POST | `/fulfillments/:id`, `/ship`, `/accept-split`, `/override-split` | internal | OPS, MGR, ADMIN | Zod ✓ |
| GET/POST | `/backorders`, `/:id/consolidate` | internal | OPS, MGR, ADMIN | Zod ✓ |
| POST | `/sales-orders/:id/billing/confirm` | internal | FIN, MGR, ADMIN | Zod ✓ |
| GET/POST | `/invoices`, `/:id`, `/:id/payments` | internal | FIN, MGR, ADMIN | Zod ✓ |
| GET/PATCH/POST | `/subscriptions`, `/:id`, `/:id/cancel` | internal | FIN, MGR, ADMIN | Zod ✓ |
| GET/PATCH | `/credit-notes`, `/:id`, `/:id/status` | internal | FIN, MGR, ADMIN | Zod ✓ |
| GET/POST | `/deal-health/*`, `/quotations/:id/deal-health` | internal | REP, MGR, ADMIN | Zod ✓ |
| GET/PATCH | `/notifications`, `/:id/read` | internal | **any** | Zod ✓ |
| GET | `/products/:id/recommendations` | internal | REP, MGR, ADMIN | Zod ✓ |
| GET | `/reports/sales-summary`, `/discount-exceptions` | internal | FIN, MGR, ADMIN | Zod ✓ |
| GET | `/customers`, `/users` | internal | REP/MGR/ADMIN; users = all | partial |
| GET | `/portal/quotations`, `/invoices` (+`/:id`) | portal | — | Zod ✓ |

**Assessment:** every mutating route is authenticated and role-guarded. Validation coverage is good.
The gaps are in *business* correctness and concurrency, not in the middleware wiring.

### Backend defects

- **CONFIRMED (P0) AUD-001** — `ACCEPTED` unreachable (§6 Flow 3).
- **CONFIRMED (P1) AUD-007** — Discount-engine compound-scope bug. `resolveEffectiveCeiling` filters
  with `isGlobal || productId match || categoryId match || customerTierId match`. `007_discount_engine.sql`
  permits all three scope columns to be set simultaneously with no CHECK forcing exactly-one-scope.
  A rule scoped "product P1 **AND** tier GOLD" therefore also applies to *every other product* for
  GOLD customers and to *every other tier* buying P1, and `Math.min` lets it win. `priority` — the
  column that exists precisely to break scope ties — is never read.
- **CONFIRMED (P1) AUD-008** — `fulfillment.overrideSplit` validates against the wrong warehouse:
  ```ts
  const [inventoryRow] = await fulfillmentRepository.lockInventoryForProducts(client, [item.product_id]);
  const available = inventoryRow ? Number(inventoryRow.quantity_available) : 0;
  ```
  `lockInventoryForProducts` runs `WHERE i.product_id = ANY($1)` with **no warehouse filter and no
  ORDER BY** — it returns rows for every active warehouse. `[0]` is an arbitrary warehouse; the
  reservation then targets `fulfillment.warehouse_id`. Mitigated by
  `chk_inventory_available CHECK (quantity_available >= 0)`, so the failure mode is an **unhandled
  CHECK violation → HTTP 500** rather than silent oversell. Broken feature either way.
- **CONFIRMED (P2)** — `overrideSplit` returns the pre-update `fulfillment` row, so the client
  receives stale data.
- **CONFIRMED (P2) AUD-016** — Admin CRUD writes **no** `audit_logs` (contradicts `docs/api.md:341`
  and FR4). The most security-relevant mutations in the system — discount ceilings, approval levels,
  price lists — are unaudited.
- **CONFIRMED (P2) AUD-017** — `fulfillment.ship`, `acceptSplit`, `overrideSplit` all pass
  `actorId: null` to `insertAuditLog` although `req.user` is available. FR4's "who did what" is lost.
- **CONFIRMED (P2) AUD-018** — `notificationsService.notify` documents itself as fire-and-forget, but
  callers `await` it without `catch`. Its own transaction is separate (so no rollback), yet a failure
  still 500s a request whose business transaction already committed.
- **CONFIRMED (P2) AUD-020** — `reporting.discountExceptions` applies `WHERE de.risk_level = 'HIGH'`
  *before* `DISTINCT ON … ORDER BY evaluated_at DESC`, so it selects the latest **HIGH** evaluation,
  not the latest evaluation. A renegotiated, now-compliant line stays on the exceptions report
  permanently — contradicting the function's own docstring.
- **CONFIRMED (P3)** — `reporting.salesSummary` compares a `DATE` string against `TIMESTAMPTZ`
  `created_at`; `to='2026-09-05'` resolves to midnight and excludes that entire day (off-by-one).
- **CONFIRMED (P3)** — `portal.listQuotationsForCustomer` / `listInvoicesForCustomer` have **no
  pagination** — unbounded result sets.
- **CONFIRMED (P3)** — `upsell.service` is a pass-through; `min_margin_percent` is caller-supplied,
  so a rep can pass `0` and defeat FR5's margin governance.
- **CONFIRMED (P3)** — `withTransaction`'s `catch` awaits `ROLLBACK`; if that throws (dropped
  connection) it replaces and masks the original error.
- **CONFIRMED (P3)** — No `unhandledRejection` / `uncaughtException` handlers; graceful shutdown has
  no forced-exit timeout, so a hung connection blocks `server.close` forever.

**Positives worth recording:** SQL is uniformly parameterized; `${where}` fragments are built from
code-controlled strings with `$n` placeholders; the CRUD factory derives columns from a trusted
allow-list (`columns.filter(...)`), which also prevents mass assignment; `sales_rep_id` and actor ids
are always taken from the token, never the body; `errorHandler` never leaks internals.

---

## 9. Database Audit

> **UPDATE (post-audit, same day) — a teammate's schema refactor landed mid-remediation.**
> After this audit was written, `git pull origin dev` brought in commit `fe6d88d`
> ("refactor(db): minimize schema to remove dead columns and stored redundancy"), authored
> independently of this remediation pass. Its own commit message states plainly:
> **"application code has not been updated to match this schema yet."** That is still true.
> Per explicit user instruction, this remediation pass did **not** attempt the large rewrite
> needed to reconcile application code with this refactor — only two narrow, safe fixes were
> made (below). Everything else the refactor touches is now a **P0 regression relative to
> this audit's original findings** and is documented exhaustively in §9.1–§9.3 so the next
> pass can execute it without re-discovering the blast radius.

24 migrations (002–025), ~41 tables. Structurally still the strongest part of the codebase — the
refactor's actual design goals (derive money totals from line items instead of storing them;
fold the customer-portal link into `users.customer_id`) are reasonable — but it now has an
**incomplete migration in progress**, which is a materially different state than "solid" until
application code catches up.

**Confirmed strengths (unchanged):** UUID PKs with `gen_random_uuid()`; deliberate, documented FK
delete behaviour (`RESTRICT` on approval/negotiation history, `CASCADE` on owned children,
`SET NULL` on optional scoping); extensive CHECK constraints on money, quantities, percentages and
every status enum; `set_updated_at()` triggers (on the tables that kept them); `sales_orders.quotation_id
UNIQUE` (1:1 enforced at DB level); `audit_logs` blocks UPDATE/DELETE at the DB level.

### 9.1 What this pass reconciled (safe, isolated, non-breaking)

| Fix | Files |
|---|---|
| `approval_requests.approval_level` was renamed to `approval_level_id` by the refactor. Updated the two `INSERT`s and the one field read that used the old name — a pure rename, no behavior change. | `discount-engine.repository.ts`, `approvals.repository.ts`, `approvals.model.ts`, `approvals.service.ts`, `approvals.test.ts` |
| **New migration `025_restore_app_compatible_timestamps.sql`** — restores `created_at` (as a plain `TIMESTAMPTZ NOT NULL DEFAULT now()` column + index) on the 15 tables where the refactor's blanket "minimize schema" pass dropped a column that is **not** redundant (unlike the money totals, a timestamp isn't derivable from anything else) and that current code demonstrably still queries. This was chosen over rewriting the ~15 call sites because it's strictly additive, reversible, and doesn't touch a single line of TypeScript. It does **not** touch or reverse the refactor's real design changes (the derived-totals views, or `customer_users` → `users.customer_id`) — see §9.2, which is intentionally left alone this pass. | `backend/migrations/025_restore_app_compatible_timestamps.sql` (new) |

The 15 tables restored, with the exact call site that would otherwise 500 with `column "created_at"
does not exist`: `quotation_items` (`quotations.repository.ts:65,176`, `portal.repository.ts:31`),
`sales_orders` (`sales-orders.repository.ts:166`), `sales_order_items` (`sales-orders.repository.ts:142`),
`fulfillments` (`fulfillment.repository.ts:263`), `invoices` (`billing.repository.ts:265`), `payments`
(`payments.repository.ts:27`), `subscriptions` (`subscriptions.repository.ts:31`), and — via
`shared/crud/crudRepository.ts`'s `list()`, whose `ORDER BY` defaults to `created_at DESC` and is
never overridden by any of these resource configs — `customer_tiers`, `discount_rules`,
`approval_levels`, `price_lists`, `product_categories`, `recommendation_rules`, `warehouses`,
`subscription_plans`.

### 9.2 What remains broken — NOT reconciled this pass (explicit user decision)

This is large, cross-cutting, and was correctly deferred rather than rushed. **Do not attempt
this piecemeal** — plan it as one coordinated pass per §28's dependency ordering (schema →
repository → service → API → client → tests), ideally with the refactor's author.

**A. `customer_users` table dropped entirely (folded into `users.customer_id`).**
Breaks the portal login chain outright:
- `auth.repository.ts` — `findActiveCustomerLink()` queries `customer_users`, which no longer
  exists. Every `POST /portal/request-link` call will 500.
- `auth.service.ts` — calls the above; the entire magic-link flow is unreachable until this is
  rewritten to read `users.customer_id` directly.
- **Fix shape:** replace the `customer_users` JOIN with `SELECT customer_id FROM users WHERE id =
  $1 AND status = 'ACTIVE'`; the "first active link" ambiguity this table existed to handle no
  longer applies (a user has at most one `customer_id`).

**B. Stored money totals removed from `quotations`, `quotation_items`, `sales_orders`,
`sales_order_items`, `invoices`, `invoice_items` — replaced by 6 read-only views
(`quotation_item_amounts`, `quotation_totals`, `sales_order_item_amounts`, `sales_order_totals`,
`invoice_item_amounts`, `invoice_totals`).** This is the change with the widest blast radius:

| Column removed | Still read/written at | What breaks |
|---|---|---|
| `quotation_items.discount_amount`, `.line_total` | `quotations.repository.ts:80,90,92,203,206,209`; `quotations.service.ts:167,169`; `quotations.model.ts:40,42` | `addItem` INSERT names these columns — 500 on every add-item call. `recalculateTotals` sums a column that no longer exists on the child table it groups from. |
| `quotations.subtotal/discount_total/tax_total/grand_total` | Same `recalculateTotals`; every place that reads `quotation.subtotal` etc. (portal.service.ts's confirm flow, sales-orders.service.ts's convert, reporting) | These columns no longer exist on `quotations` at all — must `JOIN quotation_totals` instead. |
| `quotation_items.discount_amount`, `.line_total` (write) | `negotiations.repository.ts:177` (`UPDATE quotation_items SET ... discount_amount = $3, line_total = $4`), `:214-216` (`recalculateQuotationTotals`, same shape as quotations.repository's version) | Every counter-offer 500s. |
| `quotation_items.discount_amount`, `.line_total` (read, for conversion) | `sales-orders.repository.ts:79` (`listQuotationItemsForConversion` selects these columns), `sales-orders.service.ts:69-70` maps them into `sales_order_items.discount`/`.total` — but `sales_order_items` **also** changed shape (now `discount` + `tax_percent`, no `total` column at all; totals come from `sales_order_item_amounts`) | The P0 fix in this very audit (`convertFromQuotation`) is built on a source schema that source table no longer has. **This must be the first thing re-verified once B is tackled**, since it's the fix this whole remediation pass was built around. |
| `quotation_items.line_total` (read) | `billing.repository.ts:81`; `billing.service.ts:79,82,87,110,111,121` (`generateBillingForOrder`'s entire ONE_TIME/RECURRING split math) | Every billing-generation call 500s or (worse, if `SELECT *` masks the missing column with `undefined`) produces `NaN` invoice totals silently. |
| `quotations.grand_total`/`discount_total` (read) | `reporting.repository.ts` (`salesSummary`'s `SUM(grand_total)`, `AVG(discount_total)`) | Sales summary report 500s. |

**Fix shape (do not do piecemeal — one PR):** every repository above needs its `SELECT`/`INSERT`
rewritten to either (a) compute the same figures in TypeScript from `quantity/unit_price/
discount_percent/tax_percent` — duplicating the view's formula, which reintroduces the exact
staleness risk the refactor was trying to eliminate — or (b) `JOIN` the new views
(`quotation_item_amounts`, `quotation_totals`, `sales_order_item_amounts`, `sales_order_totals`,
`invoice_item_amounts`, `invoice_totals`) and read the derived columns from there. **(b) is
correct** and is almost certainly the refactor author's intent; it just hasn't been wired up.
`sales_order_items.discount`/`.tax_percent` (the new, renamed shape) also need every write site
that used to compute `discount_amount`/`line_total` updated to compute an absolute `discount`
amount instead of a percentage-derived one, per `011_sales_orders.sql`'s new comment ("discount is
an absolute per-line amount frozen at conversion time... a fact, not a derived value").

### 9.3 Updated DB findings after the refactor

| ID | Sev | Finding |
|---|---|---|
| DB-14 | **P0** | Portal login (`POST /portal/request-link`) is broken end-to-end: `customer_users` no longer exists. See §9.2.A. |
| DB-15 | **P0** | Every quotation-item mutation (`addItem`, negotiation counter-offers) and every quotation/sales-order/invoice total read is broken: the columns were replaced by views nothing reads from yet. See §9.2.B. This makes the AUD-001 fix in this same audit **currently unverifiable against the live schema** — the fix is correct against the schema it was written for (pre-refactor), and needs re-validation once §9.2.B is done. |
| DB-16 | P2 (fixed this pass) | `approval_requests.approval_level` renamed to `approval_level_id` with no app-code update — now reconciled, see §9.1. |
| DB-17 | P2 (fixed this pass) | `created_at` dropped from 15 tables current code depends on for ordering — now restored additively via migration 025, see §9.1. |
| DB-1 | P1 (unchanged, still open) | No unique/partial index preventing multiple `PENDING` `approval_requests` per quotation. Still applies post-refactor; not addressed this pass (out of scope — flagged for §28 Phase 3). |
| DB-3/DB-4 | P2 (superseded) | The original "compound discount-rule scoping has no CHECK" finding is superseded by this pass's own fix to `discountEngine.ts` (specificity-based precedence, §11 LB-1) — no DB change needed; the engine now handles compound scopes correctly rather than needing the DB to forbid them. |

**Revised verification priority:** before any further backend work, `docker compose up -d
postgres && npm run migrate` against a clean DB (still not possible on this machine — Docker
unavailable) is now more urgent than before, since §9.2 cannot be safely reconciled by reading
migration SQL alone — the interaction between the new views and `NUMERIC` rounding at each layer
needs to be checked against real query output, not inferred.

### Findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| DB-1 | P1 | No unique/partial index preventing multiple `PENDING` `approval_requests` per quotation | `008_approvals.sql` — repeated counter-offers accumulate duplicates |
| DB-2 | P2 | `approval_requests.assigned_to` exists but is never written or read | `discount-engine.repository.createApprovalRequest` omits it |
| DB-3 | P2 | `discount_rules` allows compound scoping with no CHECK enforcing exactly-one-scope | Root enabler of AUD-007 |
| DB-4 | P2 | `discount_rules.min_discount`, `priority`, `approval_required`, `approval_level`, `sales_role` never read | Engine docstring admits it |
| DB-5 | P2 | `inventory.quantity_available = on_hand - reserved` is an app-maintained invariant with no DB enforcement | Not a generated column; drift possible if any path updates one field only |
| DB-6 | P2 | `deal_health_scores` appended on every item add / discount check / fulfillment event | Unbounded growth; no retention policy |
| DB-7 | P2 | `discount_evaluations` appended per item per check | Same |
| DB-8 | P3 | `approval_actions` CHECK allows `COMMENTED`/`CANCELLED`; docs document `RETURN` | Enum/doc divergence |
| DB-9 | P3 | No `ON DELETE` review for `customer_users.user_id CASCADE` — deleting a `users` row silently removes portal access | `004_customers.sql` |
| DB-10 | P3 | Migrations are forward-only; **no down/rollback scripts** | `backend/migrations/` |
| DB-11 | P3 | `migrate.js` wraps each file in its own transaction but has **no advisory lock** — two concurrent deploys can race | `scripts/migrate.js` |
| DB-12 | LIKELY P2 | `subscriptions` has no `quantity` column, so `modify` cannot recover the current quantity | Root enabler of AUD-010 |
| DB-13 | P4 | Migration `001` absent (intentionally deleted); runner's lexicographic sort is still correct | Confirmed via `git log --diff-filter=D` |

### Database integrity scenarios

| Scenario | Verdict | Evidence |
|---|---|---|
| Duplicate insertion (billing) | ✅ Safe | `lockOrderForBilling` (`FOR UPDATE`) + `hasBillingForOrder` inside the TX |
| Duplicate insertion (approval requests) | 🔴 Unsafe | No lock, no unique constraint (DB-1) |
| Duplicate insertion (fulfillments) | 🔴 Unsafe | `allocate` checks status outside the TX |
| Concurrent update (subscriptions) | ✅ Safe | `findByIdForUpdate` |
| Concurrent update (approvals) | 🔴 Unsafe | `findById` outside the TX |
| Concurrent update (inventory) | 🟡 Partial | `FOR UPDATE` in `allocate`; `ship` unlocked |
| Partial failure / rollback | ✅ Safe within a TX | `withTransaction` |
| Partial failure **across** TXs | 🔴 Unsafe | `submit` → `checkDiscounts`, and every post-commit `.then()` |
| Missing FK record | ✅ Safe | FKs enforced |
| Deleted related record | ✅ Safe | `RESTRICT` on business-critical history |
| Orphan records | ✅ Safe | `CASCADE` on owned children |
| Invalid values | ✅ Safe | CHECK constraints + Zod |
| Null values | ✅ Safe | `NOT NULL` widely applied |
| Constraint violation handling | 🟡 Partial | `mapDbError` used in quotations/auth/CRUD; **not** in fulfillment/billing → raw 500s |
| Stale data | 🔴 Unsafe | `overrideSplit` returns pre-update row; UI reads localStorage |
| Backup / PITR | ⚪ Not configured | No backup script, no WAL/PITR config |

---

## 10. API Contract Audit

| Contract point | Frontend | Backend | Docs | Verdict |
|---|---|---|---|---|
| `GET /customers/:id` | called | **absent** | absent | 🔴 404, silently swallowed |
| `GET /users/:id` | called | **absent** | absent | 🔴 404, silently swallowed |
| Approval action verbs | `ApiApprovalAction` | `APPROVED\|REJECTED\|ESCALATED\|COMMENTED\|CANCELLED` | `APPROVE\|REJECT\|ESCALATE\|RETURN` | 🔴 docs wrong |
| Negotiation message types | `TEXT\|COUNTER_OFFER` | same | `COMMENT\|COUNTER_OFFER\|ACCEPTANCE\|REJECTION` | 🔴 docs wrong |
| Recommendations path | `/products/:id/recommendations` | same | `/quotations/:id/recommendations` | 🔴 docs wrong |
| Reports path | `/reports/sales-summary` | same | `/reports` | 🔴 docs wrong |
| `POST /portal/quotations/:id/confirm` | mapped to `convert` | **absent** | documented | 🔴 FR9 missing |
| `GET /reports/export` | client-side jspdf/xlsx | **absent** | documented | 🟡 implemented differently |
| Signup wrong role | — | 400 (Zod wins) | 400 documented, 403 in code | 🟡 dead 403 branch |
| Response envelope | unwraps `data` ✓ | `sendSuccess` ✓ | ✓ | 🟢 consistent |
| Error envelope | `ApiError` ✓ | `errorHandler` ✓ | ✓ | 🟢 consistent |
| Pagination shape | `getListItems` | `buildPaginatedResult` | `{items,total,page,limit}` | 🟡 backend also returns `totalPages/hasNextPage/hasPreviousPage`, undocumented |
| `NUMERIC` → string | typed as `string` ✓ | `pg` returns strings ✓ | — | 🟢 correct |
| CI env var | reads `VITE_API_BASE_URL` | — | CI sets `VITE_API_URL` | 🔴 wrong name, silently ignored |

---

## 11. Business Logic Audit — LOGICAL BUGS

> Code that runs successfully and produces the **wrong result**. First-class defects.

| ID | Sev | Logical bug | Wrong result produced |
|---|---|---|---|
| **LB-1** | P1 | Discount ceiling OR-matching (AUD-007) | A compound-scoped rule silently caps unrelated products/tiers. Legitimate discounts are rejected; the wrong ceiling is written to `discount_evaluations.allowed_discount`. |
| **LB-2** | P1 | `computeNextBillingDate` month-end overflow | `new Date(Date.UTC(2026,0,31)); setUTCMonth(+1)` → Feb 31 → normalizes to **Mar 3**. A subscription starting Jan 31 skips February entirely. Aug 31 → Oct 1. Tests only cover the 5th and 15th, so this passes CI. |
| **LB-3** | P1 | `subscriptions.modify` quantity default | `const quantity = input.quantity ?? 1`. `subscriptions` stores no quantity, so PATCHing only `plan_id` silently resets a 5-seat subscription to 1 seat and rewrites `current_price`. Money is wrong, no error raised. |
| **LB-4** | P1 | Subscription price model conflict | Initial `current_price` = Σ `quotation_items.line_total` (**tax-inclusive**); after any modify it becomes `plan.price × quantity` (**tax-exclusive**). The first PATCH silently changes the pricing basis. Cancellation refunds are then computed on whichever basis happens to be stored. |
| **LB-5** | P2 | `discountExceptions` filter order | Latest **HIGH** evaluation, not latest evaluation. Fixed deals never leave the exceptions report. |
| **LB-6** | P2 | `applyModification` forces `status='MODIFIED'` | A subscription is never `ACTIVE` again; `next_billing_date` is **not** recalculated on a MONTHLY→YEARLY change, so the next bill fires on the old cadence at the new price. |
| **LB-7** | P2 | Deal-health `delayRisk` uses `quotations.updated_at` | `recalculate()` is invoked from `addItem`/`checkDiscounts`/fulfillment — always immediately after a write — so `daysSinceLastActivity ≈ 0` and `delayRisk = 0`. With no scheduler, the `STALLED` alert (≥5 days) can never fire. FR10 is inert. |
| **LB-8** | P2 | Frontend/backend deal-health thresholds diverge | Backend `STALLED_DAYS_THRESHOLD = 5`, `SLIPPAGE = 3`. Frontend `stalledThresholdDays = 14`, `deliverySlippageDaysThreshold = 14`. Backend has no rep-baseline concept at all, while the frontend (and FR10) require comparison against the rep's historical average. Two systems, two answers, same deal. |
| **LB-9** | P2 | Duplicate `PENDING` approval requests | Each counter-offer re-runs `checkDiscounts`, creating a new request without cancelling the prior one. The approvals queue shows N duplicates. |
| **LB-10** | P2 | LOW-risk auto-approval leaves no approval record | `status='APPROVED'` with no `approval_requests`/`approval_actions` row. FR4's audit trail has a hole. |
| **LB-11** | P3 | `salesSummary` date range excludes the `to` day | DATE-vs-TIMESTAMPTZ midnight truncation. |
| **LB-12** | P3 | `ProtectedRoute` uses `.replace('_','')` (first occurrence) while `useAuth.hasRole` uses `/_/g` | Inconsistent role normalization between the two guards. |
| **LB-13** | P3 | `upsell` margin threshold is caller-supplied | `min_margin_percent=0` returns every low-margin recommendation, defeating FR5. |

---

## 12. Authentication Audit

**Correct:** bcrypt with configurable rounds; identical generic error for unknown-email / wrong-password /
inactive account (no user enumeration); `CUSTOMER` role blocked from internal login; dual-scope JWTs
with a `scope` claim checked on verify; magic-link tokens are `crypto.randomBytes(32)`, single-use
(deleted on lookup regardless of validity) and 15-minute TTL; `devToken` gated on `NODE_ENV !== 'production'`;
`docs/security.md`'s "never log a bearer credential" is honoured.

### Findings

- **CONFIRMED (P0) AUD-002 — `NODE_ENV` defaults to `'development'`.**
  `config/env.ts`: `NODE_ENV: z.enum([...]).default('development')`. If `NODE_ENV` is unset in
  production, `POST /portal/request-link` returns `devToken` in the HTTP response body. **Anyone who
  knows a customer's email address obtains a valid portal session for that customer.** Full
  cross-tenant account takeover, gated only on a defaulted environment variable. The same default
  also silently disarms the seed script's production guard.
- **CONFIRMED (P1) AUD-004 — Hardcoded demo credentials in the frontend bundle.**
  `services/authService.ts:47-53`: `admin@dev.local` / `manager@dev.local` / `rep@dev.local` /
  `portal@dev.local` with `DEMO_PASSWORD = 'DevPassword123!'`, with **no `import.meta.env.DEV` guard** —
  shipped to production. `seed.js` *is* production-guarded (good), so exploitation requires the seed
  to have run with `NODE_ENV` unset — which AUD-002 makes likely. Chained, these two give unauthenticated
  ADMIN access.
- **CONFIRMED (P1) AUD-027 — Magic links in an in-memory `Map`.** Lost on restart; broken across
  instances; **expired entries are never swept** (deleted only on lookup), so repeated
  `/portal/request-link` calls for a valid email grow the map without bound → memory-exhaustion DoS.
- **CONFIRMED (P2)** — No refresh-token flow despite `JWT_REFRESH_EXPIRY` being configured and
  validated. Sessions hard-expire at 15 minutes with no renewal.
- **CONFIRMED (P2)** — No account lockout, no per-account throttle, and no stricter rate limit on
  `/auth/login`; only the global 100-req/15-min IP bucket stands between an attacker and password
  brute-force.
- **CONFIRMED (P2)** — Tokens in `localStorage` → readable by any XSS. React escapes by default and
  no `dangerouslySetInnerHTML` was found, so the current exposure is low, but this is not the
  defence-in-depth posture `docs/security.md` implies.
- **CONFIRMED (P2)** — `authenticate` never re-checks the DB, so a deactivated user or a demoted role
  stays valid for the full token lifetime. Documented as a deliberate trade-off; acceptable at 15
  minutes, but it must be stated as a risk.
- **LIKELY (P4)** — Timing oracle on `/portal/request-link`: a non-existent email takes one query, a
  valid linked one takes two plus `randomBytes`. Measurable in principle.

---

## 13. Authorization Audit

**Correct:** `requireRole` is applied at router level on every mutating route; row-level ownership is
enforced in services (`assertCanAccessQuotation`, `approvals.getDetail`, `notifications.markRead`);
**portal tenant isolation is genuinely correct** — every query in `portal.repository.ts` filters by
`customer_id` in the SQL `WHERE` clause, and `tests/integration/portal-resources.test.ts` proves
customer B receives 404 for customer A's quotation (CI log confirms this test passes).

### Findings

- **CONFIRMED (P1) AUD-014 — No approver-level binding.** `approval_requests.assigned_to` is never
  set and never checked. Any `SALES_MANAGER` can approve any request at any level, including one
  escalated *away* from them. The multi-level chain provides no segregation of duties.
- **CONFIRMED (P1) AUD-003 — Client-side-only authorization for simulation-backed pages.** Every
  admin configuration page enforces permissions purely in `constants/permissions.ts` +
  `domain/permissions/`. Since those pages never call the server, there is no server-side check to
  fall back on.
- **CONFIRMED (P2)** — Frontend/backend role models disagree (`/invoices`, `/subscriptions`,
  `/reports` open to any internal role in the router, restricted to FINANCE/MGR/ADMIN server-side).
- **CONFIRMED (P2)** — `GET /notifications` is authenticated but unrestricted by role; scoping is by
  `userId` in the service (correct), but a portal token cannot reach it at all, so portal users have
  no notifications.
- **CONFIRMED (P3)** — `requireOwnCustomer` (`middleware/authorize.ts`) is exported and documented but
  **never used** — dead code.
- **IDOR sweep:** quotations ✅ (ownership check), approvals ✅, notifications ✅, portal ✅.
  Sales orders / fulfillments / invoices / subscriptions / credit-notes / backorders have **no
  per-customer ownership check** — any FINANCE/OPS user can read any record by id. Defensible for
  internal staff roles, but it should be a stated decision. Currently **NOT VERIFIED as intentional**.

---

## 14. Security Audit

| Vector | Status | Evidence |
|---|---|---|
| SQL injection | 🟢 Not found | All values parameterized; `${where}` built from code-controlled strings with `$n`; CRUD identifiers from a trusted allow-list |
| XSS | 🟢 Not found | React escaping; no `dangerouslySetInnerHTML` |
| CSRF | 🟢 N/A | Bearer token in a header, not a cookie |
| IDOR (portal) | 🟢 Safe | Proven by integration test |
| IDOR (internal) | 🟡 Broad reads | See §13 |
| Auth bypass | 🔴 **AUD-002** | `devToken` leak under default `NODE_ENV` |
| Privilege escalation | 🔴 **AUD-014** | Any manager approves any level |
| Hardcoded credentials | 🔴 **AUD-004** | `DevPassword123!` in the shipped bundle |
| Secrets in git | 🟢 Clean | `git log --all --diff-filter=A` for `.env`/`.pem`/`.key`/`id_rsa` → none |
| Secret values in logs | 🟢 Clean | Magic-link logging deliberately removed |
| Command injection / path traversal / SSRF / file upload | 🟢 N/A | No `exec`, no `fs` on user input, no outbound fetch, no upload endpoint |
| Unsafe deserialization | 🟢 N/A | `express.json` only |
| CORS | 🟢 Correct | Single origin from `FRONTEND_URL`, credentials true, explicit methods/headers |
| Security headers | 🟡 Default | `helmet()` defaults; no explicit CSP/HSTS |
| Rate limiting | 🟡 Misconfigured | Global 100/15min (too low for an SPA, too high for login) |
| Dependency vulns | 🔴 **AUD-013** | `xlsx` HIGH: prototype pollution GHSA-4r6h-8v6p-xvw6 + ReDoS GHSA-5pgg-2g8v-p4x9, **no fix available**; `qs`/`body-parser` moderate via the unused frontend `express` |
| Error leakage | 🟢 Correct | Generic 500, details server-side only |
| Body size | 🟢 Bounded | 10 MB |

**No secret values are reproduced in this report.**

---

## 15. Error Handling Audit

**Correct:** every controller wraps in `try/catch(next)`; `AppError` is typed with `isOperational`;
`errorHandler` distinguishes Zod / operational / unknown; unknown errors never leak internals; the
health endpoint degrades to 503 on DB failure.

**Findings**
- **CONFIRMED (P2)** — Post-commit `.then()` blocks in `fulfillment.allocate`, `fulfillment.ship`,
  `quotations.addItem`, `negotiations.addMessage` and `discountEngine.checkDiscounts` run **after**
  the transaction commits. A failure there returns 500 for an operation that actually succeeded;
  the client retries and duplicates work.
- **CONFIRMED (P2)** — `mapDbError` is used in quotations/auth/CRUD but **not** in
  fulfillment/billing/subscriptions, so constraint violations there surface as raw 500s (this is the
  visible symptom of AUD-008).
- **CONFIRMED (P2)** — `try { … } catch { return null; }` in `directoryService` swallows every error
  including 500s.
- **CONFIRMED (P3)** — `withTransaction` `ROLLBACK` can mask the original error.
- **CONFIRMED (P3)** — No retry, timeout, or circuit-breaker anywhere; `fetch` has no timeout.
- **CI evidence (P2)** — `errorHandler.ts` 33.33% line coverage, `dbErrors.ts` 36.36%. Error paths are
  the least-tested code in the system.

---

## 16. Concurrency Audit

| Operation | Guard | Verdict |
|---|---|---|
| `billing.generateBillingForOrder` | `lockOrderForBilling` FOR UPDATE + in-TX duplicate check | 🟢 Safe |
| `subscriptions.modify` / `cancel` | `findByIdForUpdate` | 🟢 Safe |
| `fulfillment.acceptSplit` / `overrideSplit` | `findByIdForUpdate` | 🟢 Safe |
| `payments.recordPayment` | locks invoice FOR UPDATE, re-checks balance | 🟢 Safe |
| `auth.signup` | pre-check + UNIQUE + `mapDbError` → 409 | 🟢 Safe |
| **`discountEngine.checkDiscounts`** | status read outside TX | 🔴 **TOCTOU** — two concurrent submits both pass, both insert evaluations and approval requests |
| **`approvals.act`** | `findById` + status check outside TX | 🔴 **TOCTOU** — two managers both approve; two `approval_actions`, double status write |
| **`fulfillment.allocate`** | status read outside TX | 🔴 **TOCTOU** — duplicate fulfillments and double reservations |
| **`fulfillment.ship`** | `findById` + items read outside TX | 🔴 **TOCTOU** — double inventory consumption; inconsistent with its own siblings |
| `quotations.submit` | status read outside TX | 🔴 TOCTOU |
| `dealHealth.recalculate` | `findOpenAlertOfType` uses the **pool**, not the TX client | 🟡 Duplicate OPEN alerts under concurrency (same class as the bug already fixed in `allItemsFulfilled`) |
| Frontend double-submit | No in-flight guard found | 🔴 Amplifies every row above |
| `migrate.js` | No advisory lock | 🟡 Concurrent deploys race |

**Check-then-act pattern confirmed present in 5 backend services.** The codebase demonstrably *knows*
the correct pattern (`FOR UPDATE` is used correctly in 5 other places) — this is inconsistency, not
ignorance, which makes it a tractable fix.

---

## 17. Performance Audit

| Sev | Finding | Evidence |
|---|---|---|
| P2 | **Global rate limit 100 req / 15 min** applies to every route including `/health` | A single SPA dashboard load issues ~10 API calls; a real user is throttled within minutes |
| P2 | Unbounded portal list queries | `portal.repository` has no LIMIT/OFFSET |
| P2 | Bundle bloat | `seedData.ts` 82 KB + `dealStore.ts` 87 KB + `domain/` 3,483 lines shipped to production |
| P2 | `hydrateFromToken()` on every render | localStorage + base64 + JSON.parse per render per consumer |
| P2 | Row-by-row loops instead of set-based SQL | `insertInvoiceItem`, `insertFulfillmentItem`, `insertEvaluation`, `reserveInventory` all iterate |
| P2 | Extra write transaction per quotation mutation | `dealHealthService.recalculate` on every `addItem` |
| P3 | Append-only growth with no retention | `deal_health_scores`, `discount_evaluations`, `audit_logs` |
| P3 | `negotiations.listForQuotation` N+1 | `Promise.all(negotiations.map(… listMessages …))` |
| P3 | `Promise.all` over per-row inserts | Saturates the 20-connection pool under load |
| P4 | `getRecommendations` unpaginated | Small result set expected |

**No premature optimization is recommended.** The rate limit and the bundle are the only two with
user-visible impact today.

---

## 18. Testing Audit

**Hard evidence from CI run `33967526673`:**

```
ERROR: Coverage for lines (46.61%) does not meet global threshold (70%)
ERROR: Coverage for functions (31.51%) does not meet global threshold (70%)
ERROR: Coverage for statements (46.47%) does not meet global threshold (70%)
ERROR: Coverage for branches (39.78%) does not meet global threshold (70%)
##[error]Process completed with exit code 1.
```

- 26 test files, ~160 cases. **All assertions pass**; the job fails purely on the coverage gate.
- **Frontend: zero tests.** No runner, no `test` script. `frontend/src/domain/tests/*.ts` (1,055
  lines) are hand-rolled assertion helpers rendered in a UI page, never executed by CI.
- `backend/tsconfig.json` has `"exclude": ["node_modules","dist","tests"]` — `npm run typecheck`
  **does not typecheck `tests/`**.

### Tested vs untested

| Area | Coverage |
|---|---|
| Pure algorithms (`discountEngine`, `warehouseAllocation`, `dealHealth`, `billingDates`, `creditNoteCalculator`) | 🟢 Good |
| Auth (unit + integration) | 🟢 Good — 16 + 6 cases |
| Portal tenant isolation | 🟢 Proven by integration test |
| `authenticate` / `authorize` middleware | 🟢 14 cases |
| CRUD factory | 🟢 7 cases |
| Error handler / `dbErrors` | 🔴 33% / 36% |
| **Concurrency / race conditions** | 🔴 Zero tests |
| **The `submit → check-discounts → approval` chain end-to-end** | 🔴 Untested |
| **`convert` (the P0)** | 🔴 Untested — a single test would have caught AUD-001 |
| **Month-end billing dates** | 🔴 Untested — only the 5th and 15th (LB-2 hides here) |
| **All frontend logic** | 🔴 Zero |

---

## 19. Dependency Audit

| Sev | Finding |
|---|---|
| P1 | `xlsx@^0.18.5` — HIGH prototype pollution + ReDoS, **no npm fix available**. Migrate to `@e965/xlsx` or drop XLSX export. |
| P2 | `express`, `dotenv` in `frontend/dependencies` — **unused**; `express` drags in the vulnerable `qs`/`body-parser` chain that fails Security Checks. Removing it resolves that CI failure outright. |
| P2 | `@google/genai@^2.4.0` — **unused** (0 references). `aiService` delegates to a local deterministic `contextualAIAdapter`. |
| P2 | `vite` declared in **both** `dependencies` and `devDependencies`. |
| P2 | Two lockfiles tracked: `bun.lock` (90 KB) and `package-lock.json` (178 KB). CI uses `npm ci`. |
| P3 | `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss` in `dependencies` rather than `devDependencies`. |
| P3 | Backend pins `overrides` for `minimatch`/`qs`/`tar` — good practice; the frontend has none. |
| P4 | `jspdf@^4.2.1` — **SUSPECTED**: version could not be verified offline. |
| P4 | Backend deps are current and minimal (9 runtime packages). 🟢 |

---

## 20. Configuration Audit

| Sev | Finding |
|---|---|
| **P0** | `NODE_ENV` defaults to `'development'` (AUD-002) — unsafe default that unlocks the `devToken` leak and disarms the seed guard |
| P1 | **No Dockerfile** for backend or frontend; `docker-compose.yml` provisions only Postgres. There is no deployable artifact. |
| P1 | CI sets `VITE_API_URL`; code reads `VITE_API_BASE_URL` — wrong name, silently ignored |
| P2 | `frontend/.env.example` documents `GEMINI_API_KEY` and `APP_URL`, neither of which any code reads |
| P2 | No production logging configuration; `requestLogger` uses ANSI-coloured `console.log` unconditionally (its own docstring says it should be dev/test only) |
| P3 | `vite.config.ts` retains AI-Studio-specific `DISABLE_HMR` handling and a mojibake comment (`Do not modifyâfile watching…`) |
| P3 | `docker-compose` `postgres_test` has `restart: unless-stopped` and no volume |
| P3 | No `.dockerignore`, no health-check/readiness endpoint split, no graceful-shutdown timeout |
| 🟢 | `config/env.ts` validates all env vars with Zod and `process.exit(1)` on failure — **excellent** |
| 🟢 | `JWT_SECRET` enforced at ≥32 chars; `FRONTEND_URL` must be a valid URL |
| 🟢 | No `.env` file has ever been committed (verified across all history) |

---

## 21. Dead Code Audit

*(Reported only. Nothing deleted. Removal plan in §28 Phase 9.)*

| Item | Location | Evidence |
|---|---|---|
| `requireOwnCustomer` | `middleware/authorize.ts` | Exported, documented, zero call sites |
| 403 branch in `auth.service.signup` | `auth.service.ts:76-78` | Unreachable — Zod `z.literal` rejects first |
| `directoryService` | `services/index.ts:465-480` | Both endpoints 404; always returns `null` |
| `customerPortalService` | `services/index.ts:444-446` | Comment admits "no live data source" |
| `@google/genai`, `express`, `dotenv` | `frontend/package.json` | Zero imports |
| `frontend/bun.lock` | tracked | Superseded by `package-lock.json` |
| `GEMINI_API_KEY`, `APP_URL` | `frontend/.env.example` | Never read |
| `discount_rules` unused columns | `007_discount_engine.sql` | Engine docstring admits it |
| `approval_requests.assigned_to` | `008_approvals.sql` | Never written or read |
| `JWT_REFRESH_EXPIRY` | `config/env.ts` | Validated, never used |
| Admin route stubs | `App.tsx:108,110,113` | `<Navigate>` placeholders |
| `db.on('acquire')` empty handler | `config/database.ts` | Body is a comment |
| `domain/tests/*.ts` | 1,055 lines | No runner |
| Stale branches | `docs/architectural-references`, `docs/dealflow360-schema-update`, `scaffold-init` | Pre-history snapshots |

---

## 22. Duplicate Code Audit

| Duplicate | Class | Recommendation |
|---|---|---|
| Entire domain layer: `backend/src/modules/*` vs `frontend/src/domain/*` (3,483 lines) | **Divergent duplicate** — thresholds already differ (LB-8) | Delete the frontend copy; the server is authoritative. Highest-value cleanup in the repo. |
| `prorateForCycle` vs `calculateRefund` | Near-duplicate | Extract one `prorate(amount, nextBillingDate, frequency, now)` |
| `CYCLE_DAYS` + `MS_PER_DAY` | Exact duplicate in 2 files | Single shared constant |
| Line-total math: `quotations.service.addItem` vs `negotiations.service.addMessage` | Near-duplicate (deliberate, commented) | Extract `computeLineTotals()` — money math must not drift |
| `const where = conditions.length ? … : ''` in 8 repositories | Near-duplicate | Acceptable; a shared helper is optional |
| `updateQuotationStatus` in 3 repositories | Exact duplicate | Consolidate into one quotation-status module — would also make the AUD-001 gap obvious |
| `AIInsightPanel.tsx` × 2 | Exact/near duplicate components | Keep one |
| `decodeJwt` (frontend) vs `verify*Token` (backend) | **Intentional** — different purposes | Keep |
| `authenticate` / `authenticatePortal` | **Intentional** — different token scopes | Keep |

---

## 23. Comment / Bloat Audit

Comment quality is **above average** — most explain *why* (FK delete-behaviour rationale, the
`authenticateInternalOrPortal` fallback, the "no plan link in schema" assumption). Keep those.

**Problems:**
- **Comments that contradict the code (worst class — actively misleading):**
  - `notifications.service.ts`: "Fire-and-forget… never rolls back the business operation" — callers `await` it, so a failure still fails the request.
  - `auditLog.ts`: "Always call this from inside the same `withTransaction` block" — `quotations.service.create` does not.
  - `reporting.repository.ts`: "most recent evaluation per item came back HIGH" — the query does not do that.
  - `fulfillment.service.ts`: "validated against **that warehouse's** current available inventory" — it is not (AUD-008).
  - `docs/api.md:341`: "All admin writes go through `audit_logs`" — none do.
- **Stale header:** `docs/api.md:3` still says no endpoints are implemented, above ~50 documented endpoints.
- **Verbose/defensive docstrings** on trivial functions (`roundMoney`, `sendSuccess`, `AppError`) — pre-emptively justifying design choices to a reader who has not asked.
- **Commented-out code:** `config/database.ts` `db.on('acquire')` with a commented body.
- **Mojibake:** `vite.config.ts` "Do not modifyâfile watching".

---

## 24. Git Audit

| Aspect | Finding |
|---|---|
| Current branch | `dev` @ `f1c5538`, clean tree, synced with origin |
| Default branch | `main` @ `8b29d4f` |
| Branches | 11 remote |
| **CI status** | 🔴 **Failing on every recent run — including pushes to `main`** |
| Secrets in history | 🟢 None (`.env`/`.pem`/`.key`/`id_rsa` never added) |
| Largest tracked files | `backend/package-lock.json` 190 KB, `frontend/package-lock.json` 178 KB, `frontend/bun.lock` 90 KB, `dealStore.ts` 87 KB, `seedData.ts` 82 KB |
| Merged / deletable | `docs/architecture-formatting`, `docs/project-status-update`, `fix/negotiations-realtime` (0 ahead) |
| Stale pre-history | `docs/architectural-references` (10), `docs/dealflow360-schema-update` (4), `scaffold-init` (4) — merging would regress the repo |
| Needs a decision | `origin/revert-28-dev` (2 ahead: `Revert "Sync backend with latest dev"`), `origin/backend` (1), `origin/bug-Fix` (1) |
| Commit hygiene | 🟢 Conventional Commits, PR-based, no direct commits to `main` |

**Critical release-hygiene finding:** merging into `main` with a red pipeline means **no automated
check gates anything**. Branch protection requiring green checks is absent.

### SAFE GIT CLEANUP PLAN (not executed)

```bash
# 1. Verify each branch is fully contained in dev before deleting
git branch --merged dev

# 2. Delete only 0-ahead, already-merged branches (local, then remote)
git branch -d docs/architecture-formatting docs/project-status-update
git push origin --delete docs/architecture-formatting docs/project-status-update fix/negotiations-realtime

# 3. Stale pre-history branches — TAG BEFORE DELETING (they contain unique old commits)
git tag archive/docs-architectural-references origin/docs/architectural-references
git tag archive/docs-dealflow360-schema-update origin/docs/dealflow360-schema-update
git tag archive/scaffold-init origin/scaffold-init
git push origin --tags
# only then: git push origin --delete docs/architectural-references docs/dealflow360-schema-update scaffold-init

# 4. revert-28-dev — decide with the author first; do NOT delete unilaterally

# 5. Untrack the superseded lockfile (a real change; belongs in Phase 11, not cleanup)
#    git rm --cached frontend/bun.lock
```

---

## 25. Production Readiness Score

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Architecture | **6/10** | Clean backend layering; fatally undermined by the frontend split-brain (A2) and duplicated domain logic (A1) |
| 2 | Correctness | **3/10** | P0 workflow dead-end; 13 confirmed logical bugs |
| 3 | Business Logic | **4/10** | Discount scope bug, billing-date overflow, subscription price destruction, inert FR7/FR10 |
| 4 | Database | **8/10** | Best-in-repo: constraints, FK reasoning, append-only audit. Missing: PENDING-approval uniqueness, rollback scripts |
| 5 | Backend | **6/10** | Consistent, validated, parameterized; concurrency discipline inconsistent |
| 6 | Frontend | **3/10** | Two sources of truth; no tests; no 401 handling; `useAuth` not a Context |
| 7 | Security | **4/10** | Strong SQLi/XSS/CORS posture; undone by `NODE_ENV` default, shipped demo creds, HIGH `xlsx` CVEs |
| 8 | Authentication | **5/10** | Solid bcrypt/JWT/enumeration design; in-memory magic links, no refresh, no lockout |
| 9 | Authorization | **6/10** | Portal isolation proven correct; no approver-level binding; client-only for admin pages |
| 10 | API Design | **7/10** | Consistent envelope, correct verbs/status codes; 7 confirmed doc mismatches, 2 phantom endpoints |
| 11 | Error Handling | **6/10** | Excellent envelope and no leakage; post-commit failures 500 committed work; 33% handler coverage |
| 12 | Reliability | **3/10** | 5 TOCTOU races; no retries; no timeouts; cross-transaction partial failures |
| 13 | Performance | **5/10** | No N+1 catastrophes; rate limit unusable; bundle bloat; per-mutation extra transaction |
| 14 | Testing | **3/10** | 46.61% backend lines / 31.51% functions; **zero** frontend tests; no concurrency tests |
| 15 | Observability | **2/10** | `console.log` only; no structured logs, no correlation ids, no metrics, no tracing, no error reporting |
| 16 | Configuration | **5/10** | Zod validation is excellent; `NODE_ENV` default is a P0; wrong CI env var name |
| 17 | Dependencies | **4/10** | Backend clean; frontend has HIGH CVEs, 3 unused deps, duplicate lockfiles |
| 18 | Documentation | **6/10** | Genuinely extensive and thoughtful; materially inaccurate in ~8 places |
| 19 | Git Hygiene | **4/10** | Good commit/PR discipline; **red CI merged to `main`**; 6 stale branches |
| 20 | Maintainability | **5/10** | Strong module boundaries; 5 files >1,200 lines; duplicated domain layer |
| 21 | Deployment Readiness | **1/10** | **No Dockerfile, no manifest, no runbook, no backups, no monitoring** |
| | **OVERALL** | **🔴 4.5 / 10** | |

---

## 26. Complete Findings

### P0 — CRITICAL

**AUD-001 — Quote-to-cash pipeline dead-end** · CONFIRMED
- **Category:** Correctness / Business Logic · **File:** `backend/src/modules/sales-orders/sales-orders.service.ts:10`
- **Description:** `CONVERTIBLE_STATUSES = Set(['ACCEPTED'])`; no code path writes `ACCEPTED`.
- **Root cause:** `POST /portal/quotations/:id/confirm` (FR9), the documented producer of `ACCEPTED`, was never implemented.
- **Impact:** `POST /quotations/:id/convert` always 422s. Sales orders, fulfillment, backorders, invoices, payments, subscriptions, credit notes are unreachable.
- **Reproduce:** Create → submit → approve a quotation → `POST /quotations/:id/convert` → 422.
- **Fix:** Implement the portal confirm endpoint (FR9: apply accepted discount, re-run FR2/FR3, re-enter approval if still breaching, else `ACCEPTED` + convert). Interim: also accept `APPROVED` in `CONVERTIBLE_STATUSES`, matching `docs/api.md:433`.
- **Depends on:** none · **Complexity:** M (interim: XS) · **Verify:** integration test for the full chain.

**AUD-002 — `NODE_ENV` defaults to `development`, leaking portal magic-link tokens** · CONFIRMED
- **Category:** Security / Authentication · **File:** `backend/src/config/env.ts:14`, `modules/auth/auth.service.ts:163`
- **Description:** `NODE_ENV: z.enum([...]).default('development')`. Unset in production → `/portal/request-link` returns `devToken` in the response body.
- **Impact:** Anyone knowing a customer email obtains a valid portal session for that customer — cross-tenant account takeover. Also disarms `seed.js`'s production guard, enabling AUD-004.
- **Reproduce:** Deploy without `NODE_ENV`; `POST /portal/request-link {email}`; read `data.devToken`; `POST /portal/verify-link {token}`.
- **Fix:** Make `NODE_ENV` required (no default), **and** gate `devToken` on an explicit opt-in (`ALLOW_DEV_MAGIC_LINK === 'true'`) rather than on the absence of production.
- **Complexity:** XS · **Verify:** boot with `NODE_ENV` unset → must exit 1; assert no `devToken` in production mode.

### P1 — HIGH

| ID | Finding | File | Impact |
|---|---|---|---|
| **AUD-003** | Frontend split-brain: 12 pages read `localStorage` simulation, 6 read the API | `store/dealStore.ts`, `pages/*` | UI does not represent DB state; admin config never reaches the server |
| **AUD-004** | Hardcoded demo credentials in the shipped bundle | `services/authService.ts:47-53` | `admin@dev.local` / `DevPassword123!` → ADMIN if seeded (chains with AUD-002) |
| **AUD-005** | CI red on every run incl. `main`; coverage 46.61%/31.51%; frontend job dies on missing `typecheck` | `.github/workflows/quality-checks.yml` | No automated gate; frontend never typechecked/built |
| **AUD-006** | No Dockerfile / deployment manifest | repo root | Not deployable |
| **AUD-007** | Discount-engine compound-scope OR-matching (LB-1) | `discount-engine/discountEngine.ts:78-92` | Wrong ceilings; `priority` ignored |
| **AUD-008** | `overrideSplit` validates inventory against an arbitrary warehouse | `fulfillment/fulfillment.service.ts:246-254` | CHECK violation → 500; feature broken |
| **AUD-009** | `computeNextBillingDate` month-end overflow (LB-2) | `billing/billingDates.ts:11` | Jan 31 → **Mar 3**; a billing cycle is skipped |
| **AUD-010** | `subscriptions.modify` quantity defaults to 1 (LB-3) | `subscriptions/subscriptions.service.ts:101` | Silent price destruction |
| **AUD-011** | No scheduler: `billing_schedules` never consumed; STALLED never fires | backend-wide | FR7 recurring revenue inert; FR10 inert |
| **AUD-012** | `useAuth` is a hook not a Context; no 401/expiry handling | `hooks/useAuth.ts` | Fragmented auth state; dead UI after 15 min |
| **AUD-013** | `xlsx` HIGH CVEs, no fix available | `frontend/package.json` | Prototype pollution + ReDoS |
| **AUD-014** | Approval TOCTOU + no approver-level binding | `approvals/approvals.service.ts:82` | Double-approval; no segregation of duties |

### P2 — MEDIUM (21)

AUD-015 TOCTOU in `checkDiscounts`/`submit`/`allocate`/`ship` · AUD-016 admin CRUD writes no `audit_logs` ·
AUD-017 `actorId: null` in fulfillment audit rows · AUD-018 `notify()` awaited → 500s committed work ·
AUD-019 subscription `current_price` model conflict (LB-4) · AUD-020 `discountExceptions` filter order (LB-5) ·
AUD-021 frontend/backend deal-health thresholds diverge (LB-8) · AUD-022 API contract mismatches incl. two 404 endpoints ·
AUD-023 `applyModification` forces `MODIFIED`, no `next_billing_date` recalc (LB-6) · AUD-024 duplicate lockfiles ·
AUD-025 unused frontend deps (`@google/genai`, `express`, `dotenv`) · AUD-026 global rate limit 100/15min; no auth-specific limit ·
AUD-027 magic links in an unbounded in-memory `Map` · AUD-028 zero frontend tests · AUD-029 `findOpenAlertOfType` outside the TX ·
AUD-030 `addItem` post-commit `recalculate` can 500 a committed insert · AUD-031 `submit` strands quotations in `SUBMITTED` ·
AUD-032 duplicate `PENDING` approval requests (LB-9, DB-1) · AUD-033 `mapDbError` not used in fulfillment/billing ·
AUD-034 frontend/backend role models disagree on `/invoices`,`/subscriptions`,`/reports` · AUD-035 no submit-in-flight guard.

### P3 — LOW (19)

Portal lists unpaginated · `salesSummary` date off-by-one (LB-11) · `ROLLBACK` masks errors · no
`unhandledRejection`/`uncaughtException` handlers · no shutdown timeout · `requireOwnCustomer` dead ·
unreachable 403 in signup · `/portal` reachable by internal users · role-normalization inconsistency (LB-12) ·
upsell margin caller-controlled (LB-13) · `deal_health_scores` unbounded growth · N+1 in
`negotiations.listForQuotation` · no migration rollback scripts · no advisory lock in `migrate.js` ·
`requestLogger` always on · duplicate `AIInsightPanel` · 5 files >1,200 lines · admin route stubs ·
`vite.config.ts` mojibake + AI-Studio residue.

### P4 — INFORMATIONAL (8)

`docs/api.md` stale header · verbose docstrings on trivial functions · `frontend` package name
`react-example` · `db.on('acquire')` empty · `JWT_REFRESH_EXPIRY` unused · empty-object CRUD insert
edge case · timing oracle on `/portal/request-link` · `jspdf@^4.2.1` version unverified.

---

## 27. Critical Findings (deployment blockers)

1. **AUD-001** — the product's core workflow cannot complete.
2. **AUD-002** — portal authentication bypass under a default configuration value.
3. **AUD-004** — administrator credentials shipped in the client bundle.
4. **AUD-003** — the UI does not reflect the database; admin governance settings never reach the server.
5. **AUD-006** — nothing to deploy.
6. **AUD-005** — no green pipeline has ever gated a merge, including merges to `main`.

---

## 28. Implementation Plan

> **Do not begin implementation from this document alone. Await the follow-up prompt.**
> Every task below is specified but deliberately **not executed**.

### PHASE 0 — Safety / Baseline
| Task | Detail |
|---|---|
| **T0.1** | Tag current state: `git tag pre-remediation-2026-09-05 && git push origin --tags`. **Rollback:** the tag. |
| **T0.2** | Stand up Postgres (`docker compose up -d postgres`), run `npm run migrate`, verify all tables/constraints. **This is the single largest unverified assumption in this audit.** |
| **T0.3** | Capture a baseline: `npm run test:coverage`, `npm run typecheck`, `npm run lint`. Record numbers. |
| **T0.4** | Confirm with the team whether `revert-28-dev` should land before remediation. |

### PHASE 1 — Build & Runtime (unblocks all verification)
| Task | Pri | Files | Change | Verify |
|---|---|---|---|---|
| **T1.1** | P1 | `frontend/package.json` | Add `"typecheck": "tsc --noEmit"`, `"format:check"`; add Vitest + `"test"` | `npm run typecheck` exits 0 |
| **T1.2** | P1 | `quality-checks.yml` | Fix `VITE_API_URL` → `VITE_API_BASE_URL` | Build reads the right base URL |
| **T1.3** | P1 | `backend/tsconfig.json` | Include `tests/` in typecheck (or add a `tsconfig.test.json`) | Test type errors surface |
| **T1.4** | P1 | CI | Decide: raise coverage to 70% (T10.*) **or** temporarily lower the gate with an owner + deadline. **Do not silently delete the threshold.** | Pipeline green |
| **T1.5** | P1 | GitHub settings | Require green checks on `main` and `dev` | Red PRs blocked |
| **Risk** | Widening typecheck may surface a wave of pre-existing errors — timebox before committing. |

### PHASE 2 — Critical Security
| Task | Pri | Files | Change |
|---|---|---|---|
| **T2.1** | **P0** | `config/env.ts`, `auth.service.ts` | `NODE_ENV` required (drop `.default`); gate `devToken` behind explicit `ALLOW_DEV_MAGIC_LINK==='true'` (AUD-002) |
| **T2.2** | **P1** | `services/authService.ts` | Remove `DEMO_PASSWORD`/`DEMO_ROLE_EMAILS` or guard with `import.meta.env.DEV`; strip `quickLoginByRole` from prod builds (AUD-004) |
| **T2.3** | P1 | `frontend/package.json` | Remove `express`, `dotenv`, `@google/genai`; replace `xlsx` with `@e965/xlsx` or drop XLSX export (AUD-013, AUD-025) |
| **T2.4** | P1 | `approvals.routes/service` | Bind approver to `approval_level`; set and check `assigned_to` (AUD-014) |
| **T2.5** | P2 | `app.ts` | Split rate limits: strict on `/auth/*` and `/portal/request-link`, generous elsewhere (AUD-026) |
| **T2.6** | P2 | `auth.service.ts` | Persist magic links in a DB table with a TTL sweep (AUD-027) |
| **Verify** | Security Checks green; `NODE_ENV`-unset boot fails; no demo creds in `dist/`; a manager cannot approve a level they are not assigned to. |

### PHASE 3 — Database Integrity
| Task | Pri | Change |
|---|---|---|
| **T3.1** | P1 | New migration: partial unique index `ON approval_requests (quotation_id) WHERE status='PENDING'` (DB-1). **Backfill/dedupe existing rows first.** |
| **T3.2** | P2 | New migration: CHECK on `discount_rules` enforcing exactly-one-scope **or** adopt `priority` as the tie-break (pairs with T4.1) |
| **T3.3** | P3 | Author down-migrations for 002–024 (DB-10) |
| **T3.4** | P3 | `pg_advisory_lock` in `migrate.js` (DB-11) |
| **T3.5** | P3 | Retention/archival policy for `deal_health_scores`, `discount_evaluations` |
| **Risk** | T3.1 fails on existing duplicates — dedupe must precede it. **Rollback:** drop the index. |

### PHASE 4 — Backend Logic (the correctness core)
| Task | Pri | Files | Change |
|---|---|---|---|
| **T4.1** | **P0** | `sales-orders.service.ts` + new `portal` route | Implement `POST /portal/quotations/:id/confirm` (FR9); accept `APPROVED` in `CONVERTIBLE_STATUSES` (AUD-001) |
| **T4.2** | P1 | `discountEngine.ts` | Scope precedence: product > category > tier > global, `priority` as tie-break; require **all** non-null scopes to match (AUD-007) |
| **T4.3** | P1 | `fulfillment.repository/service` | Add `warehouseId` param to `lockInventoryForProducts`; validate against the fulfillment's own warehouse; return the updated row (AUD-008) |
| **T4.4** | P1 | `billingDates.ts` | Month-end clamping: `min(originalDay, daysInTargetMonth)` (AUD-009) |
| **T4.5** | P1 | `subscriptions` | Add a `quantity` column; stop defaulting to 1; unify the price model on one basis (AUD-010, AUD-019) |
| **T4.6** | P1 | new worker | Scheduler for `billing_schedules` + nightly deal-health recalculation (AUD-011) |
| **T4.7** | P1 | 5 services | `SELECT … FOR UPDATE` inside the TX for `checkDiscounts`, `approvals.act`, `allocate`, `ship`, `submit` (AUD-015) |
| **T4.8** | P2 | `shared/crud/crudService.ts` | Emit `audit_logs` on every admin create/update/delete (AUD-016) |
| **T4.9** | P2 | `fulfillment.*`, controllers | Thread `req.user.id` into `actorId` (AUD-017) |
| **T4.10** | P2 | callers of `notify` | `.catch(log)` instead of bare `await` (AUD-018) |
| **T4.11** | P2 | `reporting.repository.ts` | Latest-per-item **then** filter HIGH (AUD-020) |
| **T4.12** | P2 | `subscriptions.repository` | Preserve `ACTIVE`; recalc `next_billing_date` on frequency change (AUD-023) |
| **T4.13** | P2 | `negotiations`/`discount-engine` | Cancel the prior `PENDING` request before creating a new one (AUD-032) |
| **T4.14** | P2 | fulfillment/billing | Wrap repository calls in `mapDbError` (AUD-033) |
| **Verify** | New integration tests per task; full create→submit→approve→confirm→convert→allocate→ship→bill chain must pass. |

### PHASE 5 — API Contracts
| Task | Pri | Change |
|---|---|---|
| **T5.1** | P2 | Add `GET /customers/:id` and `GET /users/:id`, **or** delete `directoryService` (AUD-022) |
| **T5.2** | P2 | Rewrite `docs/api.md`: approval verbs, negotiation types, recommendations path, reports paths, remove the stale header, correct the `audit_logs` claim |
| **T5.3** | P3 | Document the full pagination envelope (`totalPages`/`hasNextPage`/`hasPreviousPage`) |
| **Note** | Per `CLAUDE.md`, **confirm with the user before any API-contract change.** T5.1 is a contract change. |

### PHASE 6 — Frontend Logic
| Task | Pri | Change |
|---|---|---|
| **T6.1** | **P1** | Migrate the 12 simulation-backed pages to real API hooks; retire `dealStore.ts`/`seedData.ts` (AUD-003). *Largest single work item — sequence per page.* |
| **T6.2** | P1 | Convert `useAuth` into a real Context provider (AUD-012) |
| **T6.3** | P1 | Add a 401 interceptor in `httpClient`: clear token → redirect `/login` |
| **T6.4** | P1 | Delete `frontend/src/domain/*` once T6.1 lands — the server becomes the only rule engine (AUD-021) |
| **T6.5** | P2 | Align route guards with backend roles (AUD-034) |
| **T6.6** | P2 | In-flight guards on every submit (AUD-035) |
| **Risk** | T6.1 touches every page. Do it page-by-page behind the existing route split, not as one commit. |

### PHASE 7 — Reliability
T7.1 `unhandledRejection`/`uncaughtException` handlers · T7.2 forced-exit timeout in shutdown ·
T7.3 preserve the original error across `ROLLBACK` failure · T7.4 `fetch` timeouts + retry-with-backoff
on idempotent GETs · T7.5 move post-commit side effects into an outbox or make the endpoint idempotent.

### PHASE 8 — Performance
T8.1 route-specific rate limits · T8.2 paginate portal lists · T8.3 `useState(() => hydrateFromToken())` ·
T8.4 batch multi-row inserts · T8.5 bundle analysis after T6.1/T6.4.

### PHASE 9 — Dead / Duplicate Code Removal
Remove, in order, only after the phases that make them dead: `requireOwnCustomer` · unreachable 403 ·
`directoryService`/`customerPortalService` (after T5.1) · unused deps (T2.3) · `bun.lock` ·
`GEMINI_API_KEY`/`APP_URL` · admin route stubs · duplicate `AIInsightPanel` · `domain/tests/*` (after
T10.4) · `dealStore`/`seedData`/`domain` (after T6.1/T6.4).
**Rule: nothing is deleted until its replacement is proven by a test.**

### PHASE 10 — Testing
T10.1 integration test for the full quote-to-cash chain (would have caught AUD-001) ·
T10.2 concurrency tests: parallel approve, parallel submit, parallel ship ·
T10.3 month-end billing dates (Jan 31, Aug 31, leap year) · T10.4 Vitest + React Testing Library for
the frontend · T10.5 authorization matrix test (every role × every endpoint) · T10.6 raise coverage
to the 70% gate honestly.

### PHASE 11 — Configuration & Deployment
T11.1 `Dockerfile` for backend (multi-stage) and frontend (build → nginx) · T11.2 extend
`docker-compose.yml` with app services · T11.3 `.dockerignore` · T11.4 structured logging (`pino`) with
correlation ids · T11.5 error reporting + uptime monitoring · T11.6 documented backup/restore
(`pg_dump` schedule + a **tested** restore) · T11.7 `/health/ready` vs `/health/live` · T11.8 secrets
management (not `.env` on disk).

### PHASE 12 — Git Cleanup
Execute §24's plan. Enable branch protection (T1.5) **before** cleanup.

### PHASE 13 — Final Production Validation
Full-chain smoke test against a fresh migrated DB · load test at expected concurrency · external
security review of auth/authz · restore-from-backup drill · re-run this audit.

---

## 29. Dependency-Ordered Roadmap

```
PHASE 0  Baseline + live DB verification
   │
   ├─► PHASE 1  Build/CI green ──────────────┐ (nothing below is verifiable without this)
   │                                          │
   ├─► PHASE 2  Security (T2.1 is standalone; do it first)
   │                                          │
   ▼                                          ▼
PHASE 3  DB schema (approval uniqueness, discount scope, subscription.quantity)
   │            ▲
   │            │ T4.5 requires T3's quantity column
   ▼            │
PHASE 4  Backend logic ── T4.1 (P0) unblocks EVERYTHING downstream
   │         T4.2 needs T3.2 · T4.5 needs T3 · T4.7 is independent
   ▼
PHASE 5  API contracts (only after backend behaviour is final)
   │
   ▼
PHASE 6  Frontend (must follow Phase 5 — never rewire the client before the contract is settled)
   │
   ├─► PHASE 7  Reliability      ┐
   ├─► PHASE 8  Performance      ├─ parallelizable after Phase 6
   ▼                             ┘
PHASE 9  Dead-code removal (only what Phases 4–6 made dead)
   │
   ▼
PHASE 10 Testing (write alongside 4–6; the coverage gate closes here)
   │
   ▼
PHASE 11 Deployment infrastructure
   │
   ▼
PHASE 12 Git cleanup ──► PHASE 13 Final validation
```

**Hard ordering rules**
1. **Never change the frontend before the API contract is settled** (Phase 5 → 6).
2. **Schema before service before API before client before tests** for any single feature.
3. **T4.1 first among logic tasks** — no downstream module can be tested until `convert` works.
4. **T2.1 can and should ship immediately** — one line, no dependencies, closes a P0.
5. **Delete nothing until its replacement is covered by a test.**

---

## 30. Risk Register

### CRITICAL
| Risk | Prob. | Impact | Area | Mitigation |
|---|---|---|---|---|
| Deployed with `NODE_ENV` unset → portal takeover | **High** (it is the default) | Critical | Auth | T2.1 before any deploy |
| Demo ADMIN credentials usable in a seeded environment | Medium | Critical | Auth | T2.2 + verify seeding |
| Core workflow unusable in production | **Certain** today | Critical | Business | T4.1 |
| Admin governance config never persists server-side | **Certain** today | Critical | Business | T6.1 |

### HIGH
| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Wrong discount ceilings approve/reject the wrong deals | High | High | T4.2 |
| Subscription price silently destroyed on modify | High | High | T4.5 |
| Billing cycle skipped for month-end starts | Medium | High | T4.4 |
| Double-approval under concurrent managers | Medium | High | T4.7 |
| Inventory CHECK violation → 500 on override-split | High | Medium | T4.3 |
| `xlsx` prototype pollution exploited via crafted export | Low | High | T2.3 |
| Red CI lets a regression reach `main` | **Certain** today | High | T1.4 + T1.5 |

### MEDIUM
Duplicate PENDING approvals · unaudited admin writes · reports never clear fixed exceptions ·
15-min session expiry with no recovery UX · rate limit throttles legitimate users ·
in-memory magic links lost on restart · frontend/backend rule divergence.

### LOW
Date-range off-by-one · unpaginated portal lists · stale branches · comment drift · bundle size.

---

## 31. Regression Risks — "What Could Break?"

| Change | What could break |
|---|---|
| **T2.1** (`NODE_ENV` required) | Every local dev environment and CI job lacking `NODE_ENV`; the portal demo flow that relies on `devToken`. **Mitigate:** add `NODE_ENV=development` to `.env.example` and all CI jobs in the same commit. |
| **T2.2** (remove demo creds) | Any demo/presentation script using quick-login. **Mitigate:** keep it behind `import.meta.env.DEV`. |
| **T2.3** (`xlsx` swap) | XLSX export output; the import path changes. **Mitigate:** snapshot-test one export. |
| **T3.1** (approval unique index) | **Migration fails outright if duplicates already exist.** **Mitigate:** dedupe script first; test on a restored copy. |
| **T4.1** (`ACCEPTED`) | Nothing today (the path is dead) — but it opens the *entire* downstream pipeline to real traffic for the first time. Expect latent bugs in fulfillment/billing to surface immediately. |
| **T4.2** (discount scope) | **Existing `discount_evaluations` become inconsistent with the new rule.** Approvals may be created where none were before. **Mitigate:** shadow-run old vs new over historical data before switching. |
| **T4.4** (billing dates) | Existing `next_billing_date` values were computed with the buggy rule. **Mitigate:** decide explicitly whether to backfill; document it. |
| **T4.5** (`subscriptions.quantity`) | Every existing subscription needs a backfilled quantity; `current_price` basis changes. **Mitigate:** derive from `subscription_items`; reconcile before/after totals. |
| **T4.7** (`FOR UPDATE`) | New lock contention and possible deadlocks under load. **Mitigate:** consistent lock ordering; load-test. |
| **T4.8** (admin audit) | `audit_logs` volume grows sharply. **Mitigate:** size it; add retention. |
| **T6.1** (retire `dealStore`) | **Highest-regression item in the plan** — every page changes; `localStorage` state is abandoned, so any user data living only there is lost. **Mitigate:** page-by-page; announce the data reset; keep the simulation behind a flag for one release. |
| **T6.2** (auth Context) | Every `useAuth` consumer re-renders differently; latent ordering bugs surface. |
| **T5.2** (docs rewrite) | Any external consumer coded against the current (wrong) docs — none known. |
| **Git cleanup** | Deleting stale branches destroys their unique commits. **Mitigate:** tag first (§24). |

---

## 32. Verification Plan

| Category | Method | Command / Evidence |
|---|---|---|
| Build | Both packages compile | `cd backend && npm run build`; `cd frontend && npm run build` |
| Types | Src **and** tests | `npm run typecheck` in both (after T1.1/T1.3) |
| Lint/format | | `npm run lint && npm run format:check` |
| Unit | | `npm run test` |
| Coverage | ≥70% honestly | `npm run test:coverage` |
| Integration | Against a real migrated DB | `docker compose up -d postgres && npm run migrate && npm run test` |
| **Schema** | **All tables + constraints on a clean DB** | `\dt`, `\d+ <table>` — **still unverified; highest-priority gap** |
| Full chain | create→item→submit→approve→confirm→convert→allocate→ship→bill→pay | New integration test (T10.1) |
| Concurrency | Parallel approve / submit / ship | New tests (T10.2) |
| AuthZ matrix | Every role × every endpoint | New test (T10.5) |
| Tenant isolation | Customer B cannot read A | Existing test — **already passing ✓** |
| Security | Dependency + secret scan | `npm audit --audit-level=high`; `gitleaks detect` |
| Bundle | Post-cleanup size | `vite build --mode production` + analyzer |
| Load | Expected concurrency | k6/autocannon — **not yet performed** |
| Restore drill | Backup actually restores | `pg_dump` → fresh instance → full chain test |
| Manual | Every page against a live backend | Scripted walkthrough |

---

## 33. Remaining Questions / Unknowns

1. **Was the client-side simulation an intentional demo strategy, or abandoned scaffolding?** This
   single answer determines whether T6.1 is the top priority or out of scope.
2. **What is the intended producer of `ACCEPTED`** — the portal confirm endpoint (FR9), a manager
   action, or should `convert` simply accept `APPROVED`?
3. **Should `discount_rules` support compound scopes?** If yes, T4.2 must require *all* non-null
   scopes to match. If no, T3.2 adds a CHECK. The schema currently allows what the engine cannot
   handle.
4. **Is `subscriptions.current_price` tax-inclusive or tax-exclusive?** The two code paths disagree;
   this is a money-correctness decision, not a coding one.
5. **Is broad internal read access to all sales orders/invoices/subscriptions intentional**, or
   should FINANCE/OPS be scoped by team/customer?
6. **Where will this deploy** (VM, container platform, PaaS)? Determines Phase 11 entirely.
7. **Is there a production database yet?** If so, every Phase 3 migration needs a backfill plan.
8. **Who owns the red CI?** It has been failing across many merges; someone decided to proceed.
9. **What is the real target concurrency?** The 20-connection pool and 100-req/15-min limit are
   untested against any stated number.
10. **`origin/revert-28-dev`** — is that revert intended to land?
11. **`jspdf@^4.2.1`** — could not be verified offline; confirm it resolves.
12. **Data retention/GDPR obligations** for `audit_logs` and `customers` — none documented.

---

# PRODUCTION-GRADE ACCEPTANCE CRITERIA

| # | Category | Status | Evidence | Remaining Risk | Required Action | Verification Method |
|---|---|---|---|---|---|---|
| 1 | **Functional Correctness** | 🔴 **FAIL** | AUD-001: `ACCEPTED` never written by any code path; `convert` always 422s | Core product function unusable | T4.1 | Full-chain integration test |
| 2 | **Business Logic** | 🔴 **FAIL** | 13 confirmed logical bugs (LB-1…LB-13): discount scope, billing dates, subscription pricing, inert FR7/FR10 | Wrong approvals, wrong money, missed billing | T4.2, T4.4, T4.5, T4.6, T4.11 | Unit tests per rule + shadow-run vs history |
| 3 | **Data Integrity** | 🟡 **PARTIAL** | Strong CHECK/FK/unique coverage; but no PENDING-approval uniqueness (DB-1), app-maintained `quantity_available` invariant (DB-5), 5 TOCTOU races | Duplicate approvals; inventory drift | T3.1, T4.7 | Concurrency tests + constraint verification on a live DB |
| 4 | **Security** | 🔴 **FAIL** | AUD-002 (`NODE_ENV` default → devToken leak), AUD-004 (creds in bundle), AUD-013 (`xlsx` HIGH, no fix) | Account takeover; ADMIN access | T2.1, T2.2, T2.3 | `npm audit --audit-level=high` clean; bundle grep; prod-mode boot test |
| 5 | **Authentication** | 🟡 **PARTIAL** | Good: bcrypt, no enumeration, scoped JWTs, single-use links. Bad: in-memory store, no refresh, no lockout | Session loss on restart; brute-force | T2.1, T2.5, T2.6 | Restart-persistence test; brute-force test |
| 6 | **Authorization** | 🟡 **PARTIAL** | Portal isolation **proven by passing integration test** ✓. But no approver-level binding (AUD-014); client-only for admin pages (AUD-003) | Privilege escalation within managers | T2.4, T6.1 | Authorization matrix test (T10.5) |
| 7 | **API Contract** | 🔴 **FAIL** | 7 documented mismatches; 2 frontend-called endpoints return 404 and are silently swallowed | Client breakage; silent data loss | T5.1, T5.2 | Contract test per endpoint |
| 8 | **Error Handling** | 🟡 **PARTIAL** | Envelope correct, no leakage ✓. But post-commit failures 500 committed work; `errorHandler` 33% covered | Duplicate work on retry | T4.10, T7.3, T7.5 | Fault-injection tests |
| 9 | **Concurrency** | 🔴 **FAIL** | 5 confirmed TOCTOU races; zero concurrency tests | Double-approval, double-ship, duplicate orders | T4.7 | Parallel-request tests (T10.2) |
| 10 | **Performance** | ⚪ **NOT VERIFIED** | No load test has ever been run. Rate limit 100/15min is provably too low for the SPA | Unknown behaviour under load | T8.1; then load-test | k6/autocannon at target concurrency |
| 11 | **Observability** | 🔴 **FAIL** | `console.log` only; no structured logs, correlation ids, metrics, tracing, or error reporting | Production incidents undiagnosable | T11.4, T11.5 | Trace one request end-to-end through logs |
| 12 | **Test Coverage** | 🔴 **FAIL** | CI: 46.61% lines / 31.51% functions / 39.78% branches vs a 70% gate. **Zero** frontend tests | Regressions ship undetected | Phase 10 | `npm run test:coverage` passes honestly |
| 13 | **Database Reliability** | 🟡 **PARTIAL** | Schema is the strongest asset. But **never verified against a live Postgres in this audit**; no rollback scripts; no migration lock | Migration behaviour unproven | T0.2, T3.3, T3.4 | `npm run migrate` on a clean DB + `\d+` inspection |
| 14 | **Configuration** | 🔴 **FAIL** | AUD-002 unsafe default; CI env var name wrong; no prod logging config | Insecure-by-default deployment | T2.1, T1.2, T11.4 | Boot with a production-shaped env |
| 15 | **Deployment** | 🔴 **FAIL** | **No Dockerfile, no manifest, no runbook.** `docker-compose.yml` provisions Postgres only | Cannot deploy at all | T11.1–T11.3 | `docker compose up` serves the full stack |
| 16 | **Dependency Health** | 🔴 **FAIL** | `xlsx` HIGH CVEs (no fix); `qs`/`body-parser` via an **unused** `express`; 3 unused deps; duplicate lockfiles | Known-exploitable code shipped | T2.3, T9 | Security Checks green |
| 17 | **Backup / Recovery** | 🔴 **FAIL** | No backup script, no PITR/WAL config, no restore procedure, no drill | Total data loss on failure | T11.6 | Documented + **rehearsed** restore |
| 18 | **Logging** | 🔴 **FAIL** | ANSI-coloured `console.log` unconditionally; its own docstring says dev/test only | No usable audit/debug trail | T11.4 | Structured JSON logs with correlation ids |
| 19 | **Monitoring** | 🔴 **FAIL** | Health endpoint exists ✓ (good, checks DB) but nothing scrapes it; no alerts, no dashboards | Outages discovered by users | T11.5, T11.7 | Alert fires on induced failure |
| 20 | **Git / Release Hygiene** | 🔴 **FAIL** | **CI red on every recent run, including pushes to `main`**; 6 stale branches; no branch protection | Unverified code reaches `main` | T1.4, T1.5, Phase 12 | Green required checks enforced |

---

# PRODUCTION-READINESS GATE

| Category | Gate |
|---|---|
| Functional Correctness | 🔴 FAIL |
| Business Logic | 🔴 FAIL |
| Data Integrity | 🟡 PARTIAL |
| Security | 🔴 FAIL |
| Authentication | 🟡 PARTIAL |
| Authorization | 🟡 PARTIAL |
| API Contract | 🔴 FAIL |
| Error Handling | 🟡 PARTIAL |
| Concurrency | 🔴 FAIL |
| Performance | ⚪ NOT VERIFIED |
| Observability | 🔴 FAIL |
| Test Coverage | 🔴 FAIL |
| Database Reliability | 🟡 PARTIAL |
| Configuration | 🔴 FAIL |
| Deployment | 🔴 FAIL |
| Dependency Health | 🔴 FAIL |
| Backup / Recovery | 🔴 FAIL |
| Logging | 🔴 FAIL |
| Monitoring | 🔴 FAIL |
| Git / Release Hygiene | 🔴 FAIL |

**🟢 PASS: 0 · 🟡 PARTIAL: 5 · 🔴 FAIL: 14 · ⚪ NOT VERIFIED: 1**

## FINAL STATUS: 🔴 **NOT PRODUCTION READY**

*(2 P0 and 12 P1 issues are open. Per the stated rule, any open P0/P1 mandates this status.)*

### 1. Can this application safely be deployed?
**No.** There is no deployment artifact, and if one existed, the core workflow could not complete and
the default configuration exposes a portal authentication bypass.

### 2. What prevents deployment?
- **AUD-001** — quote-to-cash dead-end; `convert` always fails.
- **AUD-002** — `NODE_ENV` defaults to `development`, leaking portal magic-link tokens.
- **AUD-004** — ADMIN demo credentials shipped in the client bundle.
- **AUD-006** — no Dockerfile or deployment manifest.
- **AUD-003** — 12 of 18 pages never contact the server; admin governance settings do not persist.
- **AUD-005** — CI has never been green; nothing gates merges to `main`.

### 3. What must be fixed before deployment?
All P0 and P1 items, in this order: **T2.1** (one line, closes a P0) → **T1.1–T1.5** (make CI green so
everything else is verifiable) → **T4.1** (unblocks the entire downstream product) → **T2.2, T2.3, T2.4**
(security) → **T4.2–T4.7** (correctness) → **T6.1–T6.4** (frontend truth) → **T11.1–T11.6**
(deployability, logging, backups).

### 4. What can safely be deferred?
All 19 P3 and 8 P4 items: comment drift, `docs/api.md` stale header, unpaginated portal lists, the
date-range off-by-one, duplicate `AIInsightPanel`, oversized files, admin route stubs, `vite.config`
residue, stale branch cleanup, `deal_health_scores` retention. None affect correctness, security, or
availability. Performance tuning beyond the rate limit is also deferrable until load data exists.

### 5. What has not been verified?
- **No migration was executed against a live Postgres** (Docker unavailable on the audit machine).
  Table/constraint existence is inferred from SQL source only. **This is the single largest gap.**
- No endpoint was invoked at runtime; no request/response shape was observed empirically.
- The frontend was never built or run; no rendering, routing, or responsive behaviour was observed.
- `jspdf@^4.2.1` resolvability.
- Whether any environment has been seeded with the `dev.local` accounts (which determines AUD-004's
  real severity).

### 6. What requires real-world / load testing?
Behaviour of the 20-connection pool under concurrency · whether the 100-req/15-min limit throttles
real users (analysis says yes) · lock contention and deadlock risk after T4.7 · bundle size and
first-paint after T6.1 · `audit_logs`/`deal_health_scores` growth rate · N+1 impact in
`negotiations.listForQuotation` at realistic thread counts.

### 7. What requires human / security review?
Approval segregation-of-duties model (AUD-014) — a policy decision · whether broad internal read
access is intentional (§13 IDOR sweep) · the tax-inclusive vs tax-exclusive subscription price
decision (LB-4) · whether compound discount scopes are a supported concept (Q3) · an external
penetration test of the auth/authz boundary · data-retention and GDPR obligations for `audit_logs`
and `customers`.

### 8. What requires production infrastructure verification?
Migrations against a production-shaped dataset · backup **and a rehearsed restore** · TLS termination
and the `trust proxy 1` hop count matching the real proxy · secrets management · log aggregation and
alert routing · `/health` scraping · zero-downtime deployment and rollback · DB connection limits
versus pool size across replicas.

---

**Audit complete. No application code, schema, configuration, test, or git state was modified.
`CODEBASE_AUDIT.md` is the only file created.**

**Status: NOT PRODUCTION READY — 2 P0, 12 P1 open. Awaiting the implementation prompt before any
remediation begins.**

---
---

# FINAL PRODUCTION AUDIT

*Appended 2026-09-05, after two remediation passes (the original P0/P1 backend fix pass in §1a,
and this pass, which reconciled the app against the 2026-09-05 schema-minimization refactor
`fe6d88d` that landed mid-session). This section is the current, load-bearing status — §1–§33
above and §1a are kept as historical record of what each pass found and why, not superseded in
place.*

## Executive Summary

The backend business logic (approvals, quotations, sales-order conversion, discount engine,
fulfillment, billing, subscriptions) is now correct and unit-tested against the **current**
schema. The reconciliation work in this pass closed every confirmed hard breakage the
`fe6d88d` schema refactor introduced — portal authentication, all money-total call sites across
quotations/sales-orders/negotiations/billing/reporting/**the customer portal** (a module the
first reconciliation pass missed entirely), and a fulfillment/backorders write path that would
have 500'd on every partial allocation. A new database-level invariant (DB-1, one PENDING
approval request per quotation) was added as a genuine gap-closer, not a restatement of existing
behavior. `tsc --noEmit` is clean on both packages, the frontend builds, and 165/165 backend unit
tests pass.

**What is not resolved:** the refactor's own two largest design changes — dropping stored money
totals in favor of views, and folding `customer_users` into `users.customer_id` — are now fully
reconciled in the backend, but **have never been exercised against a live database** in this
environment (see NOT VERIFIED). Frontend/backend contract drift beyond what this pass found is
still only partially audited: the frontend was not exhaustively re-walked page-by-page. CI's
frontend job was fixing a real gap (a nonexistent `typecheck` script and a nonexistent
`format:check` script), now fixed with the smallest change that made both steps meaningful again.

## Database Reconciliation

| Area | Old schema | New schema | Application change made |
|---|---|---|---|
| Portal auth | `customer_users` junction table | `users.customer_id` (nullable FK) | `auth.repository.ts::findActiveCustomerLink` rewritten to query `users`/`customers` directly; `backend/scripts/seed.js` and 2 integration test files updated to set `customer_id` instead of inserting into the dropped table |
| Quotation totals | Stored `quotations.subtotal/discount_total/tax_total/grand_total`; `quotation_items.discount_amount/line_total` | 6 read-only views (`quotation_item_amounts`, `quotation_totals`) derive everything from `quantity`/`unit_price`/`discount_percent`/`tax_percent` | `quotations.repository.ts`: every read (`findById`, `list`, `update`, `updateStatus`) now joins `quotation_totals`; `addItem`/`listItems` now insert/read through `quotation_item_amounts`; the now-impossible `recalculateTotals` method deleted; `quotations.service.ts::addItem` no longer precomputes money math in JS (the view is canonical) |
| Sales-order totals | Stored `sales_orders.*_total`, `sales_order_items.total` | `sales_order_totals`, `sales_order_item_amounts` views | `sales-orders.repository.ts` reconciled the same way; `convertFromQuotation` now reads the freshly-inserted order's totals back from the view instead of copying them from the quotation |
| Invoice totals | Stored `invoices.*_total`, `invoice_items.tax`/`total` | `invoice_totals`, `invoice_item_amounts` views; `invoice_items` has no discount column at all | `billing.repository.ts`/`billing.service.ts` reconciled; since invoices track no discount separately, the quotation-line discount is netted into `invoice_items.unit_price` at billing time (documented in code) and `discount_total` is reported as `0.00` on the API response rather than omitted, to preserve the existing response shape |
| Negotiation counter-offers | Wrote `discount_amount`/`line_total` on `quotation_items`, then recalculated quotation totals | Neither column nor `recalculateQuotationTotals` exist | `negotiations.repository.ts::updateQuotationItemDiscount` now only writes `discount_percent`; the dead recalculate step and its JS math were removed |
| Reporting | `SUM(grand_total)`/`AVG(discount_total)` on `quotations` directly | Same aggregates via `quotation_totals` | `reporting.repository.ts::salesSummary` joins the view |
| **Customer portal (new finding, not in the original audit)** | `SELECT *` on `quotations`/`invoices`/`quotation_items`/`invoice_items` | Same views as above | `portal.repository.ts` — **all six methods** rewritten to join `quotation_totals`/`invoice_totals`/read from `quotation_item_amounts`/`invoice_item_amounts`. Every customer-facing quotation/invoice view (list and detail) would otherwise have silently returned money fields as `undefined` — no error, wrong data, exactly the "runs without throwing but produces the wrong result" class this pass was asked to hunt for |
| Fulfillment/backorders (new finding) | `sales_order_items.backordered_quantity` column, kept in sync by two `UPDATE` statements | Column removed — `backorders` table is the sole record | `fulfillment.repository.ts::addBackorderedQuantity` and `backorders.repository.ts::reduceBackorderedQuantity` (and their call sites) deleted — both would have thrown `column "backordered_quantity" does not exist` on every partial allocation and every backorder consolidation |
| Approval level rename | `approval_requests.approval_level` (UUID FK, but the API/frontend field name) | Renamed to `approval_level_id` | Fixed last pass, but that rename silently broke the API contract (see below) — fixed properly this pass |
| Payments overpayment guard (new finding) | `invoices.total` was a real column `payments.service.ts` read directly | Column removed | `Number(locked.total)` was silently evaluating to `NaN`, and `amount > NaN` is always `false` — **the overpayment guard was completely disabled**, not merely inaccurate. Fixed by joining `invoice_totals` into every `billing.repository.ts` invoice read (`findInvoiceById`, `findInvoiceByIdForUpdate`, `updateInvoiceAfterPayment`, `listInvoices`) |
| Approval-request uniqueness (DB-1) | No DB constraint | New partial unique index | `026_approval_requests_one_pending_per_quotation.sql`: `CREATE UNIQUE INDEX ... ON approval_requests (quotation_id) WHERE status = 'PENDING'` — closes a real TOCTOU between `discountEngine.checkDiscounts` (locks the quotation row) and `approvals.service.ts::act`'s escalation path (locks the approval-request row instead) |

**Design decision, stated explicitly per the "when database and application disagree" rule:** the
new view-based design is sound (a total can never drift from its line items) and was preserved
in full. No column was reintroduced to avoid updating application code, with the sole exception
of `created_at` (migration `025`, done in the prior pass) — a pure, non-destructive addition
needed because roughly 15 tables' `ORDER BY created_at` queries would otherwise silently sort
however Postgres's physical row order happened to fall.

## Backend Changes

Beyond the database reconciliation above:
- `approvals.model.ts`/`approvals.repository.ts`: restored the `approval_level` field (the
  human-readable level **name**) alongside the internal `approval_level_id` (UUID). The FK
  rename in the prior pass only changed the column backing the id — but the frontend
  (`ApprovalsPages.tsx`) has always read `approval_level` expecting a name it can
  `.toLowerCase().includes('finance')` against. Every read (`list`, `findById`,
  `findByIdForUpdate`, `updateStatus`) now joins `approval_levels` and aliases `al.name AS
  approval_level`. This also fixes a **pre-existing** bug: even before this refactor,
  `approval_level` held a UUID, not a name, so that frontend check could never have matched
  "finance" — this is a genuine contract-mismatch fix, not new behavior.
- `discount-engine.service.ts::checkDiscounts` and `approvals.service.ts::act` now catch a raw
  driver error from the new DB-1 unique index and translate it via `mapDbError` into a clean 409
  instead of letting a 23505 reach the client as a 500.
- `.github/workflows/quality-checks.yml` / `frontend/package.json`: added a `typecheck` script
  alias (`tsc --noEmit`, identical to the existing `lint` script) so CI's `npm run typecheck`
  step actually exists; removed the `format:check` step for frontend since no formatter
  (prettier or otherwise) is configured there — inventing one is a tooling decision for the team,
  not a CI-repair task within this pass's scope.

## Frontend Changes

**None.** Per the standing instruction for this pass, frontend code was not modified. The
contract-mismatch findings above (`approval_level`) were fixed on the **backend** side
specifically so the existing frontend code becomes correct without changes. A full page-by-page
frontend audit (Phase 9 of the implementation prompt) was not performed this pass — see NOT
VERIFIED.

## API Contract Changes

No endpoint's request/response **shape** changed. `ApiQuotation`/`ApiInvoice`/
`ApiApprovalRequest`'s documented fields (`subtotal`, `discount_total`, `tax_total`,
`grand_total`/`total`, `approval_level`) are preserved byte-for-byte in field name; only their
*source* moved from a stored column to a view join. The one field whose real behavior changes is
`ApiInvoice.discount_total`, which is now always `"0.00"` rather than a genuine sum (see Database
Reconciliation above) — the field is preserved so no consumer breaks, but it no longer carries
information; that limitation is called out here rather than hidden.

## Security Changes

- **Payments overpayment guard restored** (see Database Reconciliation) — this is the most
  severe finding of this pass: a schema change had silently disabled a financial safety check
  that a previous, separate security-hardening pass (`1595b17`, "apply security, billing
  idempotency, auth boundaries, and client robustness fixes") had explicitly added. No new
  authorization/authentication logic was added or changed; this is entirely a "restore behavior
  that regressed" fix.
- Portal authentication (`findActiveCustomerLink`) reconciled — the customer portal login flow
  was completely broken (every `customer_users` query would throw `relation "customer_users"
  does not exist`), which is availability-affecting but not itself a security widening/narrowing;
  the tenant-isolation guarantee (scoped by `customer_id`) is unchanged in shape, only in how that
  id is looked up.

## Business Logic Changes

**None deliberately.** Every change in this pass was classified as either (a) a schema
reconciliation with no behavioral intent (make the same business rule work against the new
tables) or (b) a restoration of behavior that had regressed (the payments guard, the approval
segregation-of-duties tests from the prior pass). No approval routing rule, discount ceiling
rule, billing rule, or status-transition rule was changed. Where the schema forced a
representational choice (invoice-level discount tracking, sales-order-item totals), the choice
made is documented inline in code and in this section rather than silently decided.

## Financial Logic Validation

Traced end to end for the one-time billing path: `quantity * unit_price` → `discount_amount`
(view) → `taxable_amount` → `tax_amount` → `line_total`, at the quotation-item level; frozen onto
the sales-order item as an absolute `discount` at conversion; netted into `invoice_items.unit_price`
at billing time so `quantity * unit_price` on the invoice line already equals the discounted
amount, with `tax_percent` carried through unchanged. `auditBilling.test.ts`'s existing
tax-inclusive regression case (qty 10 × 100, discount 100, tax 10% → subtotal 900, tax 90, total
990) was updated to assert against the new call shape and still passes — the arithmetic result is
identical to before the refactor, only where it's computed (view vs. JS) changed. Rounding is
applied once per step in the view (documented in the view's own SQL comment), matching the
service layer's existing `roundMoney` convention (round-half-up to 2dp) — no double-rounding
introduced.

## Concurrency Validation

- Re-verified (no change needed) that the TOCTOU fixes from the prior pass — quotation
  conversion, approval `act`, fulfillment `allocate`/`ship`/`overrideSplit` — all still lock the
  correct row under the current schema; none of those queries touched removed columns in their
  lock/check clauses.
- **New:** DB-1's partial unique index closes a cross-module race the prior pass's row-locking
  could not: `checkDiscounts` locks the *quotation*, `approvals.service.ts::act`'s escalation
  path locks the *approval request* — two different rows, so the two code paths could previously
  both conclude "no PENDING request exists" and each insert one. A concurrency test
  (`backend/tests/integration/approvalRequestUniqueness.test.ts`) proves the constraint directly:
  two concurrent inserts of a PENDING request for the same quotation resolve to exactly one
  success and one `23505`, and a fresh insert succeeds once the prior request is no longer
  PENDING. **This test was authored but not executed** — see NOT VERIFIED.

## CI/CD Changes

See Backend Changes above (`typecheck` script + `format:check` removal for frontend). The backend
job's `npm run lint`, `format:check`, and `npm run typecheck` were all run locally against the
current tree: `lint` and `typecheck` are clean; `format:check` reports 53 files with formatting
drift that **predates this session** (files never touched this pass — e.g. `crudRouter.ts`,
`upsell.controller.ts` — are in the list), meaning this CI gate has likely been failing on `dev`
independent of this work. Not fixed here: a repo-wide `prettier --write` is a large, unrelated
diff that the minimal-change principle for this pass argues against; flagged instead as a
pre-existing, separate cleanup task.

## Tests Executed

- `cd backend && npx tsc --noEmit` — clean.
- `cd backend && npx vitest run --exclude "tests/integration/**"` — the full unit suite.
- `cd backend && npm run lint` (eslint) and `npm run format:check` (prettier) — run for the first
  time this session against the reconciled tree.
- `cd frontend && npm install && npm run lint` (tsc --noEmit) and `npm run build` — run to confirm
  the CI fix above doesn't newly break anything, since frontend `node_modules` had never been
  installed in this environment before this pass.
- Backend integration tests (`backend/tests/integration/*.test.ts`, including the new
  `approvalRequestUniqueness.test.ts`) and `npm run migrate` against a clean database — **NOT
  RUN**, see NOT VERIFIED.

## Test Results

- Backend unit tests: **165/165 passing, 25 files** (same count as the prior pass — this pass
  fixed runtime-breaking SQL and updated the tests whose fixtures encoded the old schema; it did
  not add net-new unit tests beyond the DB-1 integration test, since the changed code is
  exercised by the existing approvals/sales-orders/portal suites written last pass).
- One test failure surfaced and was fixed as a genuine, expected fallout of the reconciliation:
  `auditBilling.test.ts`'s tax-math assertion was checking `insertInvoice`'s now-removed
  `subtotal`/`taxTotal`/`total` parameters; rewritten to assert the same tax-inclusive math
  (900/90/990) against the new call shape (`insertInvoiceItem`'s `unitPrice`/`taxPercent`, and
  the final `result.invoice` merged from `invoice_totals`).
- Backend eslint: 1 error found and fixed (`quotations.service.ts`: unused `db` import left over
  from an earlier edit) — now 0 errors.
- Backend format:check: 53 pre-existing files with drift, not touched (see CI/CD Changes).
- Frontend typecheck (`tsc --noEmit`): clean.
- Frontend build (`vite build`): succeeds; pre-existing bundle-size warning (~2MB main chunk, one
  dynamic+static import overlap) unrelated to this pass.

## Build Results

`npm run build` (backend, `tsc`) — clean. `npm run build` (frontend, `vite build`) — succeeds
with the pre-existing chunk-size warning noted above.

## Migration Results

**NOT VERIFIED against a live database** — see below. All 26 migrations (`002`–`026`) were
read in full for this pass's reconciliation; the two new ones added this session
(`025_restore_app_compatible_timestamps.sql` from the prior pass, `026_approval_requests_
one_pending_per_quotation.sql` from this one) are purely additive (new columns with defaults,
new indexes) and do not alter or drop anything the refactor introduced — they cannot conflict
with `fe6d88d`'s migrations, which they run strictly after in numeric order.

## Remaining Risks

- The entire Database Reconciliation table above is unverified against a real PostgreSQL
  instance in this environment (see NOT VERIFIED) — the SQL was checked for correctness against
  the migration source, not executed.
- Frontend was not re-audited beyond the specific `approval_level` contract fix; other
  frontend/backend drift documented in the original §7/§10 audit sections may still be open.
- The backend `format:check` CI gate is failing repo-wide (53 files), independent of this pass —
  will keep failing PRs until addressed as its own task.
- `docs/database.md`, `docs/api.md`, `docs/architecture.md`, `docs/references.md`, and
  `database/schema/er-diagram.md` were updated to remove stale `customer_users` references and
  (for the ER diagram specifically) the stored-totals/`backordered_quantity`/`approval_level`
  claims; the ER diagram's per-table `created_at, updated_at` listings were **not** exhaustively
  corrected for every one of the ~15 tables that lost their `updated_at` trigger in the refactor
  — a prominent caveat was added at the top of that document pointing to the migration files as
  the source of truth instead, since exhaustively hand-correcting every line was judged lower
  value than the fixes already made, given the size of this pass.

## NOT VERIFIED

- **No live PostgreSQL instance was available in this environment.** A native `postgresql-x64-18`
  Windows service was found listening on port 5432, but no working credentials were available
  (`odoo_user`/`odoo_password` from `.env.example` and `postgres`/`postgres` both failed
  authentication), and it is an unidentified pre-existing service on the user's machine, not
  something this session provisioned — guessing further credentials against it was judged
  inappropriate rather than attempted. Consequently: migrations were **not** run against a clean
  database; the schema was **not** empirically confirmed to match what the SQL source implies;
  the `approvalRequestUniqueness.test.ts` concurrency test and all four files under
  `backend/tests/integration/` were **not** executed; no endpoint was invoked over real HTTP; no
  view's output was compared against expected values on real rows.
- Frontend was not run in a browser this pass (no golden-path click-through); only `tsc` and
  `vite build` were exercised.
- Docker was not available in this environment either, so the project's own
  `docker-compose.yml`-based Postgres could not be used as an alternative.

## Production Readiness Gate

| Category | Status | Evidence | Remaining Risk |
|---|---|---|---|
| Architecture | PASS | Layering (route→controller→service→repository→DB) preserved throughout; no logic moved between layers this pass | — |
| Frontend | NOT VERIFIED | No frontend code changed or re-run in a browser this pass | Contract drift beyond `approval_level` may remain open from the original audit |
| Backend | PASS | `tsc --noEmit` clean; 165/165 unit tests pass; eslint clean | Integration-level behavior against a real DB unverified |
| Database (schema/app agreement) | PASS | Every identified call site reconciled to the current schema, incl. 2 new-finding modules (portal, fulfillment/backorders) not caught by the original audit | Not executed against a live database |
| Business Logic | PASS | No rule changed; schema-forced representational choices documented, not silently decided | — |
| Financial Logic | PASS | End-to-end tax/discount math traced and regression-tested; the overpayment-guard regression this pass found and fixed was the most severe issue in the whole session | Not verified against real Postgres NUMERIC rounding behavior |
| API Contracts | PASS | No response shape changed; one contract-mismatch bug (`approval_level`) fixed | `discount_total` on invoices is now always `"0.00"` — documented, not hidden |
| Authentication | PASS | Portal auth (`customer_users` → `users.customer_id`) reconciled; internal auth untouched and already hardened by the prior `1595b17` pass | Not exercised over real HTTP |
| Authorization | PASS (carried over) | Segregation-of-duties, tenant scoping unchanged in shape | — |
| Security | PASS | A real, severe regression (overpayment guard silently disabled) found and fixed | Full security re-audit (Phase 12/25) not repeated this pass — no new surface introduced |
| Concurrency | PASS | DB-1 gap identified, closed with a DB constraint + app-level error handling, and a test authored | Test not executed |
| Error Handling | PASS | New DB-1 violations mapped to 409 via existing `mapDbError` convention | — |
| Performance | NOT VERIFIED | Not reviewed this pass (Phase 26 not repeated) | — |
| Testing | PARTIAL | Unit suite green; integration suite and the new concurrency test unexecuted | Infrastructure unavailable |
| CI/CD | PARTIAL | Frontend `typecheck` gap fixed; backend `format:check` found failing repo-wide, not fixed (out of scope for one pass) | — |
| Configuration | PASS (carried over) | `NODE_ENV`/`ALLOW_DEV_MAGIC_LINK` hardening from the prior pass untouched and still correct against the new schema | — |
| Migrations | PARTIAL | Source-level review complete; two new additive migrations authored | Not run against a clean database |
| Observability | NOT VERIFIED | Not reviewed this pass | — |
| Maintainability | PASS | Dead code from the refactor (recalculate methods, redundant backorder counters) removed rather than patched around | — |
| Git Hygiene | PASS | No commits made this pass per standing instruction; working tree reviewed for conflict markers (none found) | — |
| Deployment Readiness | NOT VERIFIED | No deployment checklist executed this pass | — |

## Final Verdict

**NOT PRODUCTION READY.**

Every confirmed backend/database defect this pass set out to find — the two P0 schema-refactor
breakages the user asked to be resolved, plus four more this pass discovered independently
(portal money-fields, fulfillment/backorders write failures, the disabled overpayment guard, and
the `approval_level` contract mismatch) — is now fixed, tested where the tooling in this
environment allows, and documented where it does not. That is a materially stronger state than
at the start of this pass. It does not clear the bar for PRODUCTION READY because:

1. **None of it has been verified against a real database.** Every fix here is a source-level
   correction reasoned from the migration files; a live PostgreSQL instance was not reachable in
   this environment. This is the single largest gap, exactly as the original audit's own §33
   flagged for the pre-refactor state — it is unresolved, not newly introduced.
2. Frontend was not re-walked end-to-end.
3. Backend CI's format-check gate is failing independent of this work and has not been triaged.

The correct next step is exactly what Phase 22 of the implementation prompt specifies: stand up a
disposable database, run `npm run migrate` from a clean state, and execute the full integration
suite (including the two new files this session added) before any deployment decision is made.
