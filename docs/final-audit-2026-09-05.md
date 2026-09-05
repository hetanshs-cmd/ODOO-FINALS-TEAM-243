# DealFlow360 final audit — 2026-09-05

## 1. Overall verdict

**NOT READY FOR JUDGING**

The operational UI is a browser-local simulation while the local authentication service uses the Express backend. UI mutations do not exercise PostgreSQL, server authorization, or server business rules. The provided public site serves another version: supplied rep credentials were rejected, but the Sarah Chen demo button opened a workspace with a role switcher. Its `/api/v1/health` returns HTTP 200 **HTML**, not the API health envelope.

This is a blocker-driven audit with targeted fixes, not a claim that all 76 requested checks or every button were completed. Repository structure, authoritative problem statement, requirements, core services/repositories, routes, schemas, seeds, deployment configuration, and selected UI flows were inspected. Full database-backed workflows, two rehearsals, every detail route, and exhaustive accessibility testing were not completed. The exact blockers below prevent a valid end-to-end readiness sign-off.

## 2. Problem statement compliance and requirement-to-code matrix

Source of truth: `docs/problem-statement.md`; supporting detail: `docs/requirements.md`. The former lists auto-consolidation and polished PDF/XLS formatting as stretch features, while the latter includes them in FR6/FR11. They are treated as stretch here. The problem statement explicitly requires multi-step approval; the contrary “out of scope” decision in `docs/backend-gaps.md` is a mismatch.

| Requirement | Frontend | Backend / rule layer | Database | Status and evidence |
|---|---|---|---|---|
| Login/auth | `LoginPage`, `useAuth` | `/auth/login`, `/auth/signup`, `/portal/request-link`, `/portal/verify-link` | `users`, `roles`, `customer_users` | Partially Implemented: JWT/bcrypt exist; production portal email delivery absent; security fixes below |
| Dashboard | `DashboardPage` | No integrated dashboard query | Intended quotations/approvals | Partially Implemented: reads local seed store |
| Product, price-list, customer CRUD | Admin pages, product catalog | `/admin/products`, `/admin/price-lists`, `/admin/customers`, generic CRUD | Products, price lists/items, customers/tiers | Partially Implemented: backend CRUD exists; visible pages use local store; admin price-list route redirects |
| Quotations | `QuotationsPages`, `QuotationDetailPage` | `/quotations`, `/:id/items`, `/:id/submit`; quotation service | `quotations`, `quotation_items` | Partially Implemented: separate UI and server entities; server lacks item edit/delete endpoints required by existing UI workflow |
| Discount governance | Detail page, `domain/discounts` | `discountEngine.ts`, `/:id/check-discounts` | Discount rules/evaluations | Partially Implemented: strictest ceiling exists, but frontend/backend risk formulas differ |
| Multi-step approval | `ApprovalsPages` | `/approvals/:id/act`, discount/approval services | Approval requests/actions/levels | Broken relative to required chain: HIGH routes straight to highest configured level; any allowed reviewer can approve the request; Finance is excluded by route roles |
| Audit trail | Audit components / local timeline | `insertAuditLog`, approval actions | `audit_logs`, `approval_actions` | Partially Implemented: server logs exist but UI displays a different local history; SQL append-only enforcement not verified |
| Warehouse split/backorders | `FulfillmentPages` | Allocation, accept/override/ship, backorder services | Inventory, fulfillments/items, backorders, order items | Partially Implemented: core allocation exists; concurrency and override invariant gaps remain |
| Hybrid billing | Invoice/subscription pages | `/sales-orders/:id/billing/confirm` | Invoices/items, subscriptions/items, schedules | Partially Implemented: safety guard added; no partial invoice support; UI disconnected |
| Proration | Subscription modals, `domain/billing` | `subscriptions.service`, refund calculator | Schedules, credit notes | Partially Implemented: backend uses approximate 30/91/365-day cycles; separate client engine |
| Customer portal | `CustomerPortalPages`, `PortalShell` | Scoped reads under `/portal`; negotiations endpoints | Customers, quotations, negotiations/messages | Partially Implemented: scoped API queries exist, but UI retains all local customer data and uses mock IDs |
| Counter-offer reapproval | Local negotiation store actions | `negotiationsService.addMessage` invokes discount engine | Negotiations, line changes, approvals | Partially Implemented: re-evaluation happens after the counter-offer transaction, so failure can leave a partial outcome |
| Customer confirmation | Confirm button / local store | No endpoint transitions quotation to `ACCEPTED` | Quotation status, sales order | Missing server workflow: conversion requires `ACCEPTED`, and no service writes it |
| Upsell/cross-sell | Recommendations / local rules | `/products/:id/recommendations` | Recommendation rules, products | Partially Implemented: backend exists; UI/runtime configuration is separate |
| Deal health | `DealHealthPage` | `calculateDealHealth`, health repository/actions | Scores, alerts | Partially Implemented: backend anomaly uses discount risk, not the rep's own historical average; fake UI actions removed |
| Reports/export | `ReportsPage`, reporting service/domain/export | `/reports/sales-summary`, discount exceptions | Quotations/evaluations | Partially Implemented: rich local reports; backend lacks equivalent filters/KPIs/export integration |
| Backend configuration | `/admin/*` pages | Admin CRUD resources | Configuration tables | Partially Implemented: editing visible settings does not update backend policy |
| AI layer / command center | AI panels and command center | Contextual adapter builds deterministic text | No AI persistence | Extra implementation: optional explanatory templates over local data, not a verified external model integration |
| Role permissions | Route guards and local store permissions | JWT scope and role middleware | Users/roles | Partially Implemented: real session and local acting user are separate; two authentication defects fixed |

Rule fidelity: strictest ceiling, automatic approval routing, tenant isolation, warehouse remainder/backorder, hybrid billing, and mid-cycle proration are source-defined. Configured ceiling values and approval levels are configuration-defined. Named demo users, fixed dates, demo tiers/products, UI tax defaults, AI wording, and exact risk coefficients are demo configuration or assumptions, not official numeric requirements. The conservative billing guard added here treats every ONE_TIME product as shipment-required because the schema has no goods/service discriminator; this is an explicit safety assumption.

## 3. Build / runtime and architecture

Architecture: React 19 + Vite 6 + React Router 7 frontend; custom reactive localStorage store for operational data; separate fetch service adapters and JWT session hook; Express/TypeScript backend with route/controller/service/repository boundaries, Zod validation, raw `pg`, PostgreSQL migrations. The README's older React 18/Router 6 description is stale. No `.openai/hosting.json` was found. Docker Compose provisions databases only; no complete production app deployment/proxy configuration was found. Folder is an extracted copy without `.git`, so no commit or branch was created.

| Check | Result |
|---|---|
| Frontend dependencies | Installed; missing lockfile meant `npm ci` initially failed; generated `frontend/package-lock.json` with `npm install` |
| Frontend `npm run lint` | PASS (`tsc --noEmit`) after changes |
| Frontend `npm run build` | PASS after changes; approximately 2.04 MB main minified JS, chunk-size and mixed dynamic/static import warnings |
| Backend dependencies | `npm ci` PASS |
| Backend `npm run build` | PASS after changes |
| Backend `npm run lint` | PASS after changes |
| Backend unit/service tests | PASS: 127 tests, 21 files; command `npm test -- --exclude tests/integration/**` |
| Frontend calculation checks | PASS: 28/28 via existing `runBusinessLogicTests()`; these are not browser or integration tests |
| Coverage | FAIL for unit-only run: lines 26.41%, statements 27.05%, branches 34.95%, functions 25.25%, against 70% configured global thresholds; full-suite coverage unmeasured |
| Database | BLOCKED: no listener on local PostgreSQL; Docker initially unavailable, then engine API returned 500 after launch attempt |
| Migrations | Attempted; failed `ECONNREFUSED` on localhost:5432 |
| Seed / database integration tests | Not run against a real DB because migration/database connection failed |
| Local frontend runtime | PASS at localhost:3000; login renders and preserves the page on backend failure |
| Local backend runtime | FAIL to start: bootstrap exits after PostgreSQL connection refusal |
| Public runtime | Frontend loads; API routing fails semantic health check (200 HTML) |
| Console | No captured warnings/errors in the sampled hosted routes; local failed login produced expected server/network error. Not an exhaustive console certification |

A development-only `backend/.env` was created with a generated JWT secret and local example DB settings. It is not a production configuration and contains no user production secrets. No existing environment file was overwritten; none was present at initial inspection.

## 4. Route audit

Hosted browser checks completed: `/login`, `/dashboard`, `/quotations`, `/quotations/QT-2026-8801`, `/approvals`, `/fulfillment`, `/subscriptions`, `/invoices`, `/deal-health`, `/reports`, `/products`, `/command-center`. These pages rendered recognizable headings. Nested quotation refresh rendered the detail page. Browser Back/Forward were exercised, but a complete history assertion was not obtained.

Local checks completed: login rendering, signup role selector, backend-unavailable login. Authenticated local routes are blocked by backend startup failure. Other detail IDs, invalid IDs/routes, admin subroutes, all portal routes, logout/session expiry, and exhaustive route-role combinations remain unverified in the browser. `/quotations/new` is explicitly handled by `id === 'new'` in the detail component; it is not assumed broken merely because it shares the detail route.

## 5. Button audit

| Module | Observed / reviewed result |
|---|---|
| Authentication | Hosted supplied rep credentials fail; hosted demo quick-login succeeds. Local unavailable-backend login shows error and re-enables submit. Signup now offers only Sales Rep with eight-character minimum. Quick portal login catches failures. Fake recovery-email success removed |
| Dashboard | Navigation and data render. Actions read local state; no server mutation verified |
| Quotations | List navigation and detail controls rendered. Source traces edits/save/submit into local store. No server-backed mutation pass claimed |
| Approvals | Queue renders. Source traces approval/return/reject to local state; backend chain separately incomplete |
| Fulfillment | List renders. Accept/override/restock are local store actions in UI; backend gaps below |
| Subscriptions | List renders; change/cancel modal logic and backend service inspected, not exercised end to end |
| Invoices | List renders; backend payment regression tests pass. No real payment or external money transfer performed |
| Portal | Source-reviewed. Confirm/messages/counteroffer use local state. Real customer confirmation endpoint missing |
| Deal health | Hosted placeholder screen observed. Local toast-only Nudge/Escalate actions removed; Open Deal remains. No notification is claimed to have been sent |
| Reports | Report renders; 28 combined frontend calculation/reporting assertions pass. PDF/XLSX downloads were not opened/validated |
| Admin | Source-reviewed; visible config writes remain local, not backend changes |
| AI | Command center renders. Contextual templates reviewed; external AI failure mode not exercised |

## 6. Core business flow results

PASS means the indicated tested scope only. FAIL means the required complete server-backed workflow is not established, not that every underlying function failed.

| Flow | Result | Reason |
|---|---|---|
| Quotation | FAIL end to end | UI local store and API are disconnected |
| Governance | PASS pure checks; FAIL canonical integration | Two engines with different risk calculations |
| Approval | FAIL | No mandatory sequential chain / level-specific reviewer enforcement |
| Return/resubmit | FAIL end to end | Backend can return DRAFT and retain records, but no UI integration or complete chain replay |
| Fulfillment | FAIL readiness | Allocation/ship concurrency and override invariant gaps |
| Backorder | FAIL end to end | Separate UI state; real restock/consolidation not tested |
| Hybrid billing | PASS targeted service guards; FAIL end to end | Unshipped and duplicate billing rejected in unit tests; no DB or UI integration |
| Proration | FAIL canonical requirement | Approximate backend cycles; independent client calculations |
| Cancellation/credit | FAIL end to end | Service tests exist; future schedules are not cleared by cancellation repository |
| Invoice | PASS tax regression test; FAIL end to end | Partial invoicing and immutable order-line billing mapping still missing |
| Payment | PASS service regressions; database concurrency unverified | Locked status/balance enforced; UI remains separate |
| Customer negotiation | FAIL atomicity/integration | Counteroffer committed before re-evaluation |
| Reapproval | FAIL end to end | Existing old pending request handling/sequence incomplete |
| Confirmation | FAIL | No backend transition to ACCEPTED |
| Deal health | FAIL required anomaly behavior | No own-rep historical baseline in backend scoring |
| Reports | PASS local calculation checks; FAIL real-data compliance | Rich filters/KPIs do not use backend data |
| Configuration | FAIL runtime integration | Visible changes do not reach server rules |

## 7. Bugs found and fixed

| Symptom | Root cause / files | Fix | Retest |
|---|---|---|---|
| Public client could request Admin/Finance/etc. at signup | `backend/src/modules/auth/auth.validator.ts`, `auth.service.ts` allowed arbitrary known roles | Public signup accepts only SALES_REP; service independently rejects privilege requests | Five role-boundary regression cases PASS; previous auth fixture corrected to actually test default role |
| Customer password login returned internal JWT | `auth.service.ts` checked password/status but not role | Customer role rejected with generic invalid-credentials response | Valid customer-password regression PASS |
| Concurrent/repeated full payments could overpay | `payments.service.ts` read status before transaction but did not recheck locked status or balance | Validate finite positive cent amounts, recheck locked PAID/VOID status, calculate remaining balance before insert | Stale status, overpayment, invalid-money, exact remaining payment cases PASS |
| Billing before shipment / repeated billing / cancelled order billing | `billing.service.ts`, `billing.repository.ts` lacked shipment/idempotency gate | Order lock; reject existing billing, cancelled orders, unshipped ONE_TIME order lines before writes | Four targeted billing tests PASS (including tax case below); SQL not integration-tested |
| Incorrect invoice tax/subtotal metadata | Billing treated tax-inclusive quote line total as net subtotal then calculated tax on it | Net from quantity × unit price − discount; tax from line total − net; total includes tax once | 10 × 100, discount 100, tax 90 → subtotal 900, total 990 PASS |
| Hosted frontend would default API calls to the judge's localhost | `frontend/src/services/httpClient.ts`, `.env.example` | Default `/api/v1` through same-origin proxy; documented public proxy requirement | Local proxy request reaches Vite and returns upstream error because backend is down; public proxy still absent |
| Signup sent lower-case roles and accepted too-short passwords | `authService.ts`, `LoginPage.tsx` | Send SALES_REP, eight-character minimum, remove privileged role options; preserve password whitespace | Typecheck/build PASS; browser role selector and minimum placeholder verified |
| Quick portal-login failure could escape as rejected promise | `LoginPage.tsx` lacked catch around helper | Catch and show retryable error; guard repeated pending action | Build/typecheck PASS; successful portal login blocked by DB |
| False email/notification success | `LoginPage.tsx`, `DealHealthPage.tsx` only displayed success toasts | Recovery truthfully reports unavailable; remove nonfunctional Nudge/Escalate callbacks | Build/typecheck PASS; source reviewed |
| Login advertised unseeded identities and unsupported certification | `LoginPage.tsx` hardcoded names, ISO 27001 claim, invalid default credentials | Show supplied seeded email labels, disable unavailable Finance/Meridian demo entries, clear invalid defaults, remove unsupported certification claim | Browser labels/disabled states verified |
| Magic-link bearer tokens logged | `auth.service.ts` logged token on every request | Remove token logging | Auth tests PASS; no mail transport added |
| Fresh frontend `npm ci` failed | No frontend lockfile | Generate package-lock.json | Install, typecheck, build PASS |

Security/payment boundary tests were run before changes and exposed the permissive behavior; the complete targeted set passes after the fixes. Unit mocks establish service logic, not PostgreSQL locking correctness under live contention.

## 8. API / backend issues still blocking or limiting readiness

1. **Missing acceptance transition:** no route/service writes quotation ACCEPTED; conversion is therefore unreachable through the real quote journey.
2. **Approval sequencing:** HIGH picks highest level immediately; approving any request finalizes quotation. `act` receives userId without reviewer role/level and reads resolved status outside its transaction. Finance cannot access approval routes. An approval workflow migration is needed to persist/replay a canonical chain and bind reviewers to levels.
3. **Fulfillment:** allocate and ship status guards occur before transactions, allowing concurrent stale requests. Override uses the first locked inventory row for a product instead of the fulfillment warehouse. Quantity changes do not reconcile required = allocated + backordered. Recurring lines are included in stock allocation.
4. **Negotiation:** applies changes and commits before notification/re-evaluation; downstream failure can return error after terms changed. No clear finalized-quotation guard, old pending approval invalidation, or single transaction for terms and new approval pass.
5. **Portal data minimization:** scoped detail queries are good, but `SELECT *` on quotation items includes internal columns such as margin; returning a scoped record is not sufficient customer-visible sanitization. Actual DB tenant tests remain unrun.
6. **Authorization gaps:** discount check controller does not pass the requester to an ownership check, unlike the quotation service. Existing internal tokens remain valid until expiry; no revocation system was added.
7. **Billing:** conservative all-shipped/all-at-once guard, no partial invoice accounting, no physical-service distinction. Billing still reads quotation lines rather than fully immutable commercial order-line snapshots; concurrent negotiation/finalized-term mutation must be closed before judging. One-time services in hybrid orders will wait under the guard. Duplicate partial-payment request identity is not persisted; only balance/full-payment overpayment is prevented.
8. **Subscriptions:** approximate cycle denominator, quantity defaults to 1 on plan-only changes; subscription item quantities/future schedule amounts are not kept aligned. Cancellation clears next date but leaves existing scheduled rows. No recurring schedule processor found in server bootstrap.
9. **Health/reporting:** discount anomaly is based on risk rather than rep history. Open-alert queries exclude nudged/escalated records, which can hide unresolved risk. Report filters/KPIs differ from UI; HIGH-only filtering happens before latest-evaluation selection.
10. **API contracts:** adapters type list results as arrays where backend returns paginated objects; addItem is typed as a full quotation while backend returns an item. UI mock string IDs differ from server UUIDs. These adapters must be corrected during integration.
11. **Seed/reset:** backend seed provisions basic users/customer/catalog, not the full staged demonstration dataset. UI Reset Demo replaces local state only. No integrated repeatable backend reset workflow.
12. **Development portal access:** `devToken` is returned without email ownership verification outside production. It is a demo convenience, not secure public authentication. Production mail delivery is absent.

These are not safe to hide behind additional frontend mocks. Completing them requires coordinated schema/API/UI integration and a working PostgreSQL test environment; a one-file adapter or cosmetic rewrite cannot establish correctness.

## 9. Frontend issues and UI review

The app broadly resembles an enterprise workspace, with dense tables, side navigation, status badges, quote sheets and admin modules. Hosted quote detail nevertheless showed inconsistent seed totals (net 42,800, estimated tax 4,280, grand total still 42,800), implausible upsell margin labels above 100%, and dashboard LOW labels while the quotation list showed HIGH for the same seeded quote. Those are demo/data-consistency defects still unresolved.

`dealStore` initializes as authenticated Sarah Chen independently of JWT login. Approvals/invoices/report permissions use that local currentUser; real JWT user and acting local role can disagree. `useAuth` instances listen for cross-tab storage events, not a shared same-tab auth subscription; expiry/401 propagation and account name hydration need integration work. The local portal falls back to a fixed customer ID and its underlying store contains all customer records; a UI ownership check alone is insufficient.

Local login had no document-level horizontal overflow at requested widths 1440, 1280, 1024, 768 and 430 (scrollbars reduced measured client widths to 763/426 at the last two). This is a login-only geometry check, not certification of all modules, modals, portal pages, contrast or keyboard navigation. No exhaustive accessibility audit or slow-network mutation suite was completed.

## 10. Security / role results

| Role | Result |
|---|---|
| Sales Rep | Hosted provided credentials rejected; demo button opened mock workspace. Server own-quotation checks exist, but direct discount-check ownership gap and local actor mismatch remain |
| Sales Manager | Route-level review permission exists; assigned-level/chain sequencing not enforced; no full browser approval pass |
| Finance / Operations | Roles exist in schema; no supplied/seeded Finance demo user; Finance denied on approvals routes |
| Admin | Public self-escalation fixed locally. Authenticated admin CRUD role gate exists. Local config UI still operates on separate data |
| Customer | Internal password-token issuance fixed. Query-scoped portal resources exist, but response sanitization, mock-store exposure, dev-link authentication, and missing confirmation remain blockers |

No changes were deployed to the public URL. Existing public security behavior is not repaired by editing this local folder.

## 11. Deployment results

| Surface | Result |
|---|---|
| Local frontend | Running at localhost:3000; updated source/build verified |
| Local API/DB | API refuses startup when DB is unavailable; `/api/v1/health` via Vite returns 500 |
| Production URL | Supplied Cloudflare URL renders frontend |
| Deep links / refresh | Sampled module deep links and quotation nested refresh load |
| API | Public `/api/v1/health`: 200 text/html, not JSON; cannot claim backend deployment |
| CORS | Local source uses explicit FRONTEND_URL; real cross-origin deployment not verified |
| Assets | Enough assets loaded to render sampled pages; no complete asset/network waterfall audit |
| Environment | No initial local `.env`; generated development config only. API base now relative. Public deployment needs /api reverse proxy or an explicit public API URL |
| Hosting configuration | No tunnel origin/process mapping or deployable app proxy config in supplied folder; no tunnel settings changed |

## 12. Demo rehearsal

Neither requested five-minute end-to-end rehearsal was completed. Timing each stage would invent evidence. Login, quote UI, module navigation and refresh were sampled, but approval → accepted order → fulfillment → real billing cannot be demonstrated through the supplied server-backed application.

| Stage | Actual rehearsal timing |
|---|---|
| Login / Quote / Approval / Fulfillment / Subscription | Not measured in a continuous rehearsal |
| Portal / Reapproval / Invoice / Deal health / Reports | Not measured in a continuous rehearsal |
| Reset and second full run | Not attempted: backend reset/seed and accepted-order transition are absent |

## 13. Remaining limitations and exact next gates

1. Restore a working PostgreSQL runtime and migrate an isolated test database; run integration tests and the shipping/payment contention scenarios.
2. Implement accepted quotation transition, canonical sequential approval passes, atomic counteroffers and safe finalized-term handling.
3. Enforce allocation/stock/backorder invariants, fix shipping concurrency and add order-line invoice accounting before enabling partial billing.
4. Migrate every operational page and configuration action from `dealStore` to correctly typed paginated APIs, with one authenticated actor and customer-safe response DTOs. Remove local seeded customer data from portal delivery.
5. Supply deterministic integrated seed/reset scenarios and run the full demo twice against the real database.
6. Serve the audited build with an API proxy at the public URL; rerun all role/tenant/deep-link/workflow tests, downloads, failure/latency and accessibility checks.

No data reset, public deployment, real payment, or outbound customer/rep message was performed. No wholesale rewrite, new framework, or fabricated requirement was introduced. Tests passing in the narrowed unit scope do not supersede these gates.

## 14. Files changed

Frontend:
- `frontend/src/pages/LoginPage.tsx`: signup alignment, failure handling, truthful demo/recovery labels.
- `frontend/src/pages/DealHealthPage.tsx`: remove fake notification/escalation actions and placeholder promise.
- `frontend/src/services/authService.ts`: signup role/password contract and password whitespace.
- `frontend/src/services/httpClient.ts`: same-origin API default.
- `frontend/package-lock.json`: reproducible frontend dependency resolution.

Backend:
- `backend/src/modules/auth/auth.service.ts`: role/scope boundary and token-log fixes.
- `backend/src/modules/auth/auth.validator.ts`: public signup role restriction.
- `backend/src/modules/billing/payments.service.ts`: locked balance/status and money checks.
- `backend/src/modules/billing/billing.validator.ts`: finite cent payment validation.
- `backend/src/modules/billing/billing.repository.ts`: parameterized order lock, existing billing and shipment queries.
- `backend/src/modules/billing/billing.service.ts`: billing guards and tax breakdown.

Database: no schema changes. SQL guards use existing sales orders/items, products, invoices and subscriptions. No migrations applied.

Deployment/configuration: `frontend/.env.example` documents relative/public API configuration; local `backend/.env` generated for development. No public deployment changes.

Tests:
- `backend/src/modules/auth/auth.test.ts`: correct misleading default-role test.
- `backend/tests/unit/auditSecurity.test.ts`: signup privilege and customer/internal scope regressions.
- `backend/tests/unit/auditPayments.test.ts`: locked status/balance and input boundaries.
- `backend/tests/unit/auditBilling.test.ts`: unshipped, duplicate, cancelled billing and tax cases.

Documentation: `README.md`, `docs/api.md`, this report. Generated build folders, installed node_modules, `backend/audit-coverage.log` and coverage output are local verification artifacts, not deploy/commit claims.

Implementation approach: preserve the existing service/repository architecture and add narrow validation/transaction guards. A full data-flow migration was considered; doing it without the missing DB environment, acceptance/approval contracts and repeatable seed would leave unverified security and accounting behavior. The billing guard deliberately blocks unsafe requests while exposing its all-at-once limitation. All changed backend code passes lint/build and the unit suite; no commit was made because this folder has no Git metadata.
