# Architecture — DealFlow360

## Overview

This project uses a **layered monolith** architecture with strict separation of concerns.

A clean modular monolith is preferred for a hackathon over microservices — simpler to develop, deploy, and explain during presentation. Microservices will only be considered if the problem genuinely requires them.

---

## Architectural Approaches Considered

### Approach A — Layered monolith (chosen)

Route → Controller → Service → Repository → Postgres, single deployable.

- ✅ Fastest to build in 24h, fits scaffold as-is, easiest for a 4-person team to reason about.
- ❌ Deal-health background job and billing-cycle job run in-process — acceptable at hackathon scale, would need extraction at real scale.

### Approach B — Monolith + separate worker process for scheduled jobs

Same as A, but deal-health scans and subscription billing cycles run in a second Node process reading the same DB.

- ✅ Cleaner separation, demonstrates system-design maturity to judges.
- ❌ Extra process to run/demo, more moving parts to debug live — real risk given the time budget.

**Decision: Approach A.** The "scheduled job" is simulated with a `node-cron` task inside the same Express process. Approach B was considered and rejected purely for time-budget reasons at hackathon scale — see `technology-decisions.md`.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│                  React + Vite + TypeScript               │
│                                                         │
│  Pages → Components → Hooks → Services → Constants      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API (/api/v1/...)
                       │
┌──────────────────────▼──────────────────────────────────┐
│                      BACKEND                            │
│                 Node.js + Express + TypeScript           │
│                                                         │
│  Routes                                                 │
│    ↓                                                    │
│  Middleware (auth, validation, rate-limit, logging)      │
│    ↓                                                    │
│  Controllers (parse req → call service → format res)    │
│    ↓                                                    │
│  Services (business logic, orchestration)               │
│    ↓                                                    │
│  Repositories (SQL queries, DB mapping)                 │
│    ↓                                                    │
│  PostgreSQL                                             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    DATABASE                             │
│                     PostgreSQL                          │
│            (Docker Compose for local dev)               │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Layer Responsibilities

### Route Layer

- Declares HTTP method and URL path
- Attaches middleware (authentication, rate limiting)
- Delegates to Controller
- **Forbidden:** SQL, business logic

### Controller Layer

- Parses HTTP request (body, params, query)
- Calls Validator
- Calls Service
- Formats and returns HTTP response
- **Forbidden:** SQL, business rules, direct DB access

### Service Layer

- Contains all business logic
- Enforces business rules
- Orchestrates repository calls
- Manages transactions where appropriate
- **Forbidden:** HTTP `req`/`res` objects, raw SQL

### Repository Layer

- Executes parameterized SQL queries
- Maps database rows to domain objects
- **Forbidden:** Business logic, HTTP logic

### Validator Layer

- Validates request schema (Zod)
- Checks types, formats, lengths, enums, cross-field rules
- **Forbidden:** Database side effects, business logic

---

## Module Structure

Each domain feature lives in its own module:

```
backend/src/modules/<module-name>/
  ├── <module>.routes.ts
  ├── <module>.controller.ts
  ├── <module>.service.ts
  ├── <module>.repository.ts
  ├── <module>.validator.ts
  ├── <module>.model.ts
  └── <module>.test.ts
```

**Modules (per the DealFlow360 domain, built in this order — see `development-workflow.md` for the hour-by-hour plan):**

```
auth, admin (products/categories/price-lists/customers/tiers/discount-rules/
approval-levels/warehouses/subscription-plans/recommendation-rules),
quotations, discount-engine, approvals, negotiations, upsell,
sales-orders, fulfillment, billing, portal, deal-health, notifications, reporting
```

Two hard rules that shape every module below:
1. **Every business rule (discount check, blended risk, warehouse split, proration, anomaly
   detection) lives in backend service code — never hardcoded per-screen, never faked for
   demo.** This is explicitly graded.
2. **Every approval, rejection, and edit gets an immutable `audit_log` row** — actor,
   timestamp, before/after value, reason. One table underpins the audit trail, the logging
   requirement, and every "why was this flagged" UI.

### Module Design (Backend)

Table/field names below match the definitive schema in
[`database/schema/er-diagram.md`](../database/schema/er-diagram.md).

**Auth & Config** — `POST /auth/login` (internal user, `users.role_id` → `roles.name` as the
JWT claim); `POST /portal/request-link` + `POST /portal/verify-link` (customer, magic-link,
resolved through `users.customer_id`). Admin CRUD over `products`, `product_categories`,
`price_lists`, `customer_tiers`, `discount_rules`, `approval_levels`, `warehouses`,
`subscription_plans`, `recommendation_rules` — every admin write goes through `audit_logs`.

**Discount Rule Engine** (`POST /quotations/:id/check-discounts`, run on every
`quotation_items` edit) — the single most important function in the codebase:
```
for each item in quotation.items:
    candidate_rules = discount_rules matching item.product_id
                        OR item.product.category_id
                        OR quotation.customer.customer_tier_id
    effective_ceiling = min(rule.max_discount for rule in candidate_rules)  # strictest wins
    allowed_discount = effective_ceiling
    over_by = max(0, item.discount_percent - allowed_discount)
    insert discount_evaluations row (requested_discount, allowed_discount, risk_score,
                                      risk_level, decision)   # append-only, never overwritten

blended_score = f(
    sum(item.over_by for item in items),           # total overage across the quotation
    count(item for item in items if over_by > 0),  # how many items violate
    max(item.over_by for item in items)            # worst single item
)
risk_level = "LOW" if blended_score == 0
           else "MEDIUM" if blended_score <= MEDIUM_THRESHOLD
           else "HIGH"

if risk_level != "LOW":
    create an approval_requests row at approval_levels[risk_level]
    quotation.status = "PENDING_APPROVAL"
else:
    quotation.status = "APPROVED"
```
Discount ceilings are **per-product, per-category, and per-customer-tier** (`discount_rules`
with nullable scope columns) — never a flat role-based rep/manager limit — every item is
checked against the *strictest applicable rule* across whichever scopes match it, not one
order-wide number. Ship the rule-based version first; a logistic-regression scoring layer on
top (features: total overage, violation count, worst-item overage, tier) is legitimate v2
polish only, with a hardcoded fallback if there's no training data yet.

**Approval Workflow** — `GET /approvals?status=PENDING` over `approval_requests`;
`POST /approvals/:id/act` (`APPROVE`/`REJECT`/`ESCALATE`/`RETURN`), inserting an
`approval_actions` row per action (full history, not just the latest decision). Final
`APPROVE` → quotation `status = APPROVED`, triggers sales-order conversion + fulfillment
suggestion. `REJECT` → `status = REJECTED`. `RETURN` → back to rep as `DRAFT`. Every action
also writes an `audit_logs` entry, powering the approval-detail timeline UI.

**Negotiation** — `POST /quotations/:id/negotiations` opens a `negotiations` thread;
`POST /negotiations/:id/messages` appends a `negotiation_messages` row; any pricing/discount
edit during negotiation is recorded as a `negotiation_changes` row (old/new value per field) —
this table is what lets the system detect whether a negotiation moved a price beyond its
approval threshold.

**Upsell / Cross-Sell** — `GET /quotations/:id/recommendations`: candidates from
`recommendation_rules` (`UPSELL` or `CROSS_SELL`) for products already on the quote, ranked by
`priority`, filtered to only active rules. One unified ranked list — not separate "upsell" and
"cross-sell" services.

**Sales Orders & Fulfillment** — `POST /quotations/:id/convert` creates a `sales_orders` row
(1:1 with the quotation via a unique FK) once approved/accepted, copying `quotation_items`
into `sales_order_items`. `POST /sales-orders/:id/suggest-fulfillment`: sort warehouses by
(stock available desc, shipping cost asc), greedily allocate from lowest-cost warehouses first
but **prefer fewer warehouses over marginal cost savings** (minimize shipment count is the
stated objective) — writes `fulfillments`/`fulfillment_items`; any shortfall becomes a
`backorders` row. `POST /fulfillments/:id/accept` or `/override`. A restock event auto-creates
a "consolidate remaining backorder" `notifications` row — don't make the rep poll for it.

**Billing** — `POST /sales-orders/:id/billing/confirm` splits `sales_order_items` by
`billing_type`: one-time → an `invoices` + `invoice_items` row; recurring → a `subscriptions` +
`subscription_items` row with `next_billing_date`, billed each cycle via a `billing_schedules`
row generated by a scheduled job (which in turn creates the recurring `invoices` row).
`PATCH /subscriptions/:id` prorates: `days_remaining_in_cycle / total_days_in_cycle *
price_delta`. Cancel mid-cycle with a prepaid balance → a refund `payments` row
(`status = REFUNDED`) per the configured refund rule. `POST /invoices/:id/payments` records a
`payments` row.

**Customer Portal / Negotiation** (separate route namespace `/portal/*`, separate auth
middleware, resolved through `users.customer_id`) — `GET /portal/quotations/:id` scoped to that
customer only, row-level check on every query; `POST /portal/quotations/:id/negotiations/messages`;
`POST /portal/quotations/:id/confirm`:
```
apply any accepted negotiated discount_percent to quotation_items
re-run discount rule engine (check-discounts)
if risk_level != "LOW":
    quotation.status = "PENDING_APPROVAL"   # silently re-enters approval
    notify sales_manager (notifications row)
else:
    quotation.status = "ACCEPTED"
    trigger sales-order conversion + billing module
```
This re-check is the single most important wiring point between the portal and the internal
approval engine — test it explicitly.

**Deal Health & Anomalies** — scheduled job (or on-demand for the dashboard) writes
`deal_health_scores` (history preserved, never overwritten) and `deal_alerts` rows via three
independent detectors, not one composite score:
```
# Stalled
flag quotations where status not in (ACCEPTED, CONVERTED, REJECTED, DECLINED, CANCELLED)
     and now() - updated_at > configured_stall_days
     -> insert deal_alerts (alert_type = 'STALLED')

# Discount anomaly — relative to that rep's OWN history, not a global threshold
for each sales_rep:
    rep_avg = avg(discount_percent) over rep's last N approved quotation_items
    flag new quotation where max(item.discount_percent) > rep_avg + threshold_stddev
     -> insert deal_alerts (alert_type = 'DISCOUNT_ANOMALY')

# Delivery slippage
flag fulfillments where scheduled_date < now() and status not in ('SHIPPED', 'CANCELLED')
     -> insert deal_alerts (alert_type = 'DELIVERY_SLIPPAGE')
```
`POST /deal-health/:id/escalate` and `/nudge` update `deal_alerts.status` and optionally
insert a `notifications` row.

**Reporting** — `GET /reports?period=&team=&status=&product=`: aggregate queries directly
over `quotations` / `quotation_items` / `invoices`, no separate reporting data model; export
server-side via a lightweight PDF/XLS lib.

---

## Frontend Structure

```
frontend/src/
  ├── components/       # Reusable UI components
  ├── pages/            # Page-level components (one per route)
  ├── layouts/          # Layout wrappers
  ├── hooks/            # Custom React hooks
  ├── services/         # API call wrappers
  ├── context/          # React context providers
  ├── utils/            # Pure utility functions
  ├── validators/       # Client-side validation schemas
  ├── constants/        # App constants (API URLs, enums)
  ├── types/            # TypeScript types and interfaces
  └── App.tsx
```

Two separate app shells sharing a design system but **not a session**: don't just hide
internal nav items with CSS for a "customer view" — the portal must be a genuinely separate
route tree with its own auth guard.

### Internal Workspace (`/app/*`)

| Screen | Key components | Talks to |
|---|---|---|
| Login | email/password form | `/auth/login` |
| Sales Dashboard | Pending Approvals, Open Quotations, At-Risk Deals cards, activity feed | `/quotations?status=`, `/deal-health` |
| Quotations List | Kanban or table, grouped by `quotations.status` | `/quotations` |
| Quotation Builder | product picker, cart w/ live `discount_percent`, margin indicator, upsell panel | `/quotations/:id/items`, `/check-discounts`, `/recommendations` — debounce edits, re-call `check-discounts` on every discount change |
| Approval Detail | risk score banner, per-item breakdown, `approval_actions` history, Approve/Return/Reject | `/approvals/:id` |
| Approvals List | pending/returned/escalated tabs over `approval_requests` | `/approvals?status=` |
| Negotiation Detail (internal) | message thread, `negotiation_changes` diff view | `/negotiations/:id` |
| Fulfillment Detail | warehouse split table (`fulfillment_items`), Accept/Override, backorder banner | `/fulfillments/:id` |
| Fulfillment List | live `inventory` table, sales orders awaiting fulfillment | `/sales-orders?status=` |
| Subscriptions List / Billing Detail | one-time vs recurring split view, `next_billing_date`, Modify/Cancel | `/subscriptions`, `/billing-schedules` |
| Invoices List / Detail | status pipeline (Draft→Unpaid→Paid/Overdue), payments log | `/invoices`, `/invoices/:id/payments` |
| Deal Health Dashboard | three panels (Stalled / Anomalies / Slippage) over `deal_alerts`, Escalate/Nudge | `/deal-health` |
| Admin Reporting | filters (period/team/status/product), export | `/reports` |
| Product/Price/Discount-Rule Config | admin CRUD forms | `/admin/*` |

The Quotation Builder is the most stateful screen: every discount edit optimistically
updates the local margin indicator, then reconciles against the server's `check-discounts`
response — the **server is always the source of truth** for whether approval is required;
never trust client-side math for that decision.

### Customer Portal (`/portal/*`) — separate build target

| Screen | Key components | Talks to |
|---|---|---|
| Portal Login | magic-link request/verify | `/portal/request-link` |
| Negotiation Screen | read-only quote view, per-item comment thread, counter-discount field, Submit/Confirm, status badge | `/portal/quotations/:id`, `/negotiations/messages`, `/confirm` |

---

## End-to-End Sequence

1. **Admin** configures `discount_rules`, `warehouses`, `subscription_plans` via Admin
   screens → `/admin/*` → lands in the respective tables.
   
2. **Rep** builds a quote → each `quotation_items` edit fires `check-discounts` → engine
   reads `discount_rules`, inserts a `discount_evaluations` row per item (append-only),
   computes the quotation's blended risk.

3. If risk `!= LOW` → an `approval_requests` row is created → visible in Manager's Approvals
   List.
4. Manager approves (`approval_actions` + `audit_logs`); on final approval → quotation
   converts to a `sales_orders` row, which auto-fires `suggest-fulfillment`, writing
   `fulfillments`/`fulfillment_items` (shortfall → `backorders`).
5. Rep/Finance accepts the split or overrides it → order ready for billing confirmation.
6. **Confirm** splits `sales_order_items` by `billing_type` (one-time → `invoices`; recurring
   → `subscriptions` + `billing_schedules`).

7. Customer negotiates via portal → counter-offer creates `negotiation_messages` +
   `negotiation_changes` → on **Confirm Quotation**, the portal endpoint re-runs
   `check-discounts`; if still over threshold, a new `approval_requests` row is created and
   status flips back to `PENDING_APPROVAL` (loop to step 3) — otherwise proceeds to sales
   order conversion and billing.

8. **Deal Health job** runs continuously in the background, independent of the main flow,
   writing `deal_health_scores` history and `deal_alerts` rows off `updated_at` timestamps
   and rep-relative discount stats.
   
9. **Reports** module queries the accumulated operational tables directly — no separate
   reporting data model; this is what "live data, not static charts" means in practice.

---

## Error Handling Strategy

```
Request → Validator → Controller → Service → Repository
                                      ↓
                              AppError thrown
                                      ↓
                        Global Error Handler Middleware
                                      ↓
                         Structured JSON Error Response
```

**Typed error classes:**

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public message: string,
    public details?: unknown[]
  ) { super(message); }
}
```

---

## API Design

- Versioned: `/api/v1/`
- RESTful conventions
- Consistent success/error response envelope
- Full specification in [`docs/api.md`](api.md)

---

## Database Strategy

- PostgreSQL (production-grade)
- ER-first design (database before backend code)
- All schema changes via versioned migrations
- Parameterized queries only
- Full specification in [`docs/database.md`](database.md)

---

## Security Architecture

- bcrypt password hashing
- JWT authentication (short-lived access tokens)
- Parameterized SQL
- Secure HTTP headers (Helmet)
- CORS configured per environment
- Secrets via environment variables only
- Full specification in [`docs/security.md`](security.md)

---

## Deployment (Local Development)

```
Docker Compose
  └── postgres:15 container
        └── Port 5432

Backend  → http://localhost:4000
Frontend → http://localhost:5173
```

---

## Confirmed Assumptions

- [x] Single-database architecture is sufficient (PostgreSQL, relational domain)
- [x] Monolith backend is appropriate (Approach A above)
- [x] REST API is the right paradigm (not GraphQL/WebSocket)
- [x] React is the right frontend framework
- [x] Authentication is required — two fully separate schemes (internal JWT, portal magic-link)

---

*Last updated: Phase 0 complete — DealFlow360 (definitive 41-table schema)*
