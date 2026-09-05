# Odoo Hiring Hackathon — Team 243 — DealFlow360

> **Status:** Phase 0 complete. Implementation in progress — 21 migrations applied, 13 backend modules scaffolded.

---

## Problem

**DealFlow360** is a self-governing B2B sales platform where quotations auto-route for
approval based on tiered/categorical discount rules, fulfillment auto-splits across
warehouses, billing handles one-time and recurring lines on a single order, and customers
negotiate through an isolated portal that can silently re-trigger approval.

**One-line:** Give sales reps a quote-to-cash flow where discount governance,
multi-warehouse fulfillment, hybrid billing, and customer negotiation all enforce themselves
server-side — without a manager having to manually watch every deal.

See [`docs/problem-statement.md`](docs/problem-statement.md) for full details.

---

## Target Users

| Role | What they do |
|------|-------------|
| **Sales Rep** | Builds quotations, negotiates internally, hands off to fulfillment/billing |
| **Sales Manager** | Reviews approval queue, approves/rejects/returns over-discounted deals |
| **Customer** | Views quotes, negotiates discounts, confirms orders via isolated portal |
| **Admin** | Configures discount ceilings, warehouses, subscription plans, upsell rules |

---

## Core Features

| # | Feature |
|---|---------|
| FR1 | Product / price-list / customer CRUD with tier assignment |
| FR2 | Per-line discount check against strictest of (tier ceiling, category ceiling) |
| FR3 | Blended risk scoring → 0/1/2-step approval chain |
| FR4 | Immutable audit log on every approval action |
| FR5 | Ranked upsell/cross-sell suggestions filtered by margin threshold |
| FR6 | Warehouse split minimizing shipment count, with backorder handling |
| FR7 | Hybrid billing — one-time invoices + recurring subscriptions with proration |
| FR8 | Isolated customer portal — view, comment, counter-discount, confirm |
| FR9 | Portal confirm re-runs FR2/FR3; silently re-enters approval if breached |
| FR10 | Deal health — 3 independent flags: stalled / discount anomaly / delivery slippage |
| FR11 | Filterable reporting (period/team/status/product) with PDF/XLS export |

---

## Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Backend** | Node.js + Express + TypeScript | Rule-heavy service layer; team scaffold already in place |
| **Database** | PostgreSQL 15 | FK integrity across approvals, billing, audit trail — relational by nature |
| **Query layer** | Raw `pg` (parameterized) | Avoid Prisma's migration system conflicting with custom runner |
| **Frontend** | React 18 + Vite + TypeScript | Two isolated route trees; fast dev-server iteration |
| **Routing** | React Router v6 | `/app/*` (internal) and `/portal/*` (customer) |
| **Validation** | Zod | Schema-first, TypeScript-native — both env vars and API input |
| **Auth (internal)** | JWT | Short-lived access token; `scope: "internal"` claim |
| **Auth (portal)** | Magic-link token | Separate scheme, separate JWT scope; no shared session |
| **Password hashing** | bcrypt (work factor 12) | Industry standard |
| **Scheduled jobs** | node-cron (in-process) | Deal-health + billing-cycle scans — Approach B rejected for time budget |
| **Testing** | Vitest + Supertest | Unit (mocked repo) + integration (real test DB) |
| **Container** | Docker Compose | Local PostgreSQL dev (:5432) + test (:5433) |
| **CI** | GitHub Actions | Lint + typecheck + tests + build + security audit |

Full justification: [`docs/technology-decisions.md`](docs/technology-decisions.md)

---

## Architecture

```
Browser (React + Vite)          :5173
  /app/*  → internal workspace
  /portal/* → isolated customer portal
        ↓  HTTP /api/v1/  (Vite proxy in dev)
Node.js + Express + TypeScript  :4000
  Route → Controller → Service → Repository
  Shared: withTransaction, money, jwt, documentNumber
        ↓  pg Pool (parameterized queries only)
PostgreSQL 15 (Docker Compose)  :5432 (dev)  :5433 (test)
  21 migrations — 41 tables
```

Full architecture documentation: [`docs/architecture.md`](docs/architecture.md)

---

## Database

41-table relational schema across 21 numbered SQL migrations.

```
backend/migrations/
  002_extensions_and_helpers.sql   → uuid-ossp, citext, set_updated_at()
  003_rbac.sql                     → roles, permissions, users
  004_customers.sql                → customers, tiers, price_lists
  005_products.sql                 → products, categories
  006_quotations.sql               → quotations (11 statuses), quotation_items
  007_discount_engine.sql          → discount_rules, discount_evaluations, approval_levels
  008_approvals.sql                → approval_requests, approval_actions
  009_negotiations.sql             → negotiations, messages, changes
  010_recommendations.sql          → recommendation_rules
  011_sales_orders.sql             → sales_orders, items
  012_warehouses_inventory.sql     → warehouses, inventory
  013_fulfillment.sql              → fulfillments, fulfillment_items
  014_backorders.sql               → backorders
  015_billing_invoices.sql         → invoices, invoice_items
  016_payments.sql                 → payments
  017_subscriptions.sql            → subscriptions, subscription_items
  018_billing_schedules.sql        → billing_schedules
  019_deal_health.sql              → deal_health_scores, deal_alerts
  020_notifications.sql            → notifications
  021_audit_logs.sql               → audit_logs
  022_seed_reference_data.sql      → roles, permissions, approval levels
```

Full database documentation: [`docs/database.md`](docs/database.md)

---

## Authentication & Security

- **Internal auth:** bcrypt (work factor 12) + JWT (`scope: "internal"`, 15 min expiry)
- **Portal auth:** Magic-link token (one-time, 15 min TTL) → JWT (`scope: "portal"`)
- JWT `scope` claim prevents portal tokens from working on internal endpoints
- Same generic error for wrong email, wrong password, inactive user (prevents enumeration)
- Parameterized SQL only — `$1, $2` placeholders, never string interpolation
- Helmet (14 security headers), CORS (explicit origin only), Rate limiter (100 req/15 min)
- Zod-validated env — server refuses to start with missing/weak config

Full security documentation: [`docs/security.md`](docs/security.md)

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Docker + Docker Compose
- Git

### 1. Clone

```bash
git clone <repository-url>
cd ODOO
```

### 2. Environment Variables

```bash
cp backend/.env.example backend/.env   # fill in JWT_SECRET, POSTGRES_PASSWORD
cp frontend/.env.example frontend/.env
```

### 3. Start Database

```bash
docker-compose up -d
# Waits for postgres health check before accepting connections
```

### 4. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5. Run Migrations

```bash
cd backend && npm run migrate
# Applies all 21 migrations in order; skips already-applied ones
```

### 6. Seed Reference Data

```bash
cd backend && npm run seed
# Seeds roles, permissions, approval levels — safe to re-run
```

### 7. Run Backend

```bash
cd backend && npm run dev
# http://localhost:4000/api/v1/health
```

### 8. Run Frontend

```bash
cd frontend && npm run dev
# http://localhost:5173
```

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

Key variables:

| Variable | Description |
|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars — enforced by Zod at startup |
| `JWT_ACCESS_EXPIRY` | Default `15m` |
| `BCRYPT_ROUNDS` | Default `12` |
| `FRONTEND_URL` | Exact frontend origin for CORS |

**Never commit real `.env` files.**

---

## Running Tests

```bash
# Backend unit + integration tests
cd backend && npm test

# Coverage report (70% floor on discount engine, 80% floor on services)
cd backend && npm run test:coverage

# Frontend tests
cd frontend && npm test
```

---

## Backend Module Overview

| Module | Key endpoint(s) |
|--------|----------------|
| `auth` | `POST /auth/login`, `POST /portal/request-link`, `POST /portal/verify-link` |
| `admin` | `GET/POST/PATCH /admin/*` (products, categories, discount-rules, warehouses…) |
| `quotations` | `GET/POST/PATCH /quotations`, `POST /quotations/:id/items` |
| `discount-engine` | `POST /quotations/:id/check-discounts` |
| `approvals` | `GET /approvals`, `POST /approvals/:id/act` |
| `negotiations` | `POST /quotations/:id/negotiations`, `POST /negotiations/:id/messages` |
| `upsell` | `GET /products/:id/recommendations` |
| `sales-orders` | `POST /quotations/:id/convert` |
| `fulfillment` | `POST /sales-orders/:id/suggest-fulfillment` |
| `billing` | `POST /sales-orders/:id/billing/confirm` |
| `deal-health` | `GET /deal-health`, `POST /deal-health/:id/escalate` |
| `notifications` | `GET /notifications`, `PATCH /notifications/:id/read` |
| `reporting` | `GET /reports` |

---

## Git Workflow

```
main          ← stable / demo-ready (merges only at block checkpoints)
  ↑
  dev         ← integration
    ↑
    feature/db-schema, feature/auth, feature/discount-engine,
    feature/approvals, feature/warehouse-split, feature/billing,
    feature/portal, feature/upsell, feature/deal-health, feature/reporting
```

Full workflow + 24-hour execution plan: [`docs/development-workflow.md`](docs/development-workflow.md)
Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## Team

| Member | Role |
|--------|------|
| Backend-Lead | Discount engine, approval workflow, portal re-approval wiring |
| Backend-Support | Admin CRUD, warehouse split, billing/subscriptions |
| Frontend-Lead | Quotation Builder, Upsell panel |
| Frontend-Support | Approvals screens, Fulfillment/Billing screens, Portal Negotiation |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/problem-statement.md`](docs/problem-statement.md) | DealFlow360 problem + user journeys |
| [`docs/requirements.md`](docs/requirements.md) | FR1–FR11 + NFR1–NFR5 |
| [`docs/architecture.md`](docs/architecture.md) | System architecture + module design |
| [`docs/database.md`](docs/database.md) | 41-table schema overview |
| [`docs/api.md`](docs/api.md) | Full API reference |
| [`docs/security.md`](docs/security.md) | Security design |
| [`docs/testing.md`](docs/testing.md) | Testing strategy + coverage targets |
| [`docs/development-workflow.md`](docs/development-workflow.md) | 24-hour execution plan + Git workflow |
| [`docs/technology-decisions.md`](docs/technology-decisions.md) | Justified technology choices |
| [`docs/presentation-notes.md`](docs/presentation-notes.md) | Presentation prep + reviewer Q&A |

---

*Last updated: Phase 0 complete — DealFlow360*
