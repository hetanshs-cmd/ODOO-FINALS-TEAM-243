# Database Design — DealFlow360

## Database-First Principle

This project follows an **ER-first** approach — schema was designed and approved before any
backend code was written:

```
Problem Statement → Phase 0 Analysis → Entities → ER Diagram
  → Tables + Constraints + Indexes → Migrations
    → Repositories → Services → Controllers → Routes → Frontend
```

**Backend code is never written before the database schema is approved.**

---

## Database Technology

**PostgreSQL 15** (Docker Compose, local)

Reasons:
- ACID-compliant — required for approval workflow, billing split, and audit trail
- Strong FK and CHECK constraint support
- `CITEXT` extension for case-insensitive email handling
- `uuid-ossp` for UUID primary keys
- Well-supported by `pg` (node-postgres)
- Relational by nature — the domain (approvals, billing, audit) is FK-heavy, not document-shaped

---

## Migration Strategy

All schema changes use numbered SQL migrations, tracked in `schema_migrations`:

```
backend/migrations/
  002_extensions_and_helpers.sql
  003_rbac.sql
  004_customers.sql
  005_products.sql
  006_quotations.sql
  007_discount_engine.sql
  008_approvals.sql
  009_negotiations.sql
  010_recommendations.sql
  011_sales_orders.sql
  012_warehouses_inventory.sql
  013_fulfillment.sql
  014_backorders.sql
  015_billing_invoices.sql
  016_payments.sql
  017_subscriptions.sql
  018_billing_schedules.sql
  019_deal_health.sql
  020_notifications.sql
  021_audit_logs.sql
  022_seed_reference_data.sql
```

**Rules:**
- Never manually modify schema in production
- Never modify an already-applied migration
- New changes always in a new numbered migration file
- Migrations run in numeric order, tracked in `schema_migrations`

```bash
cd backend && npm run migrate
```

---

## Normalization

**Third Normal Form (3NF)** throughout. Notable design decisions:

- `quotation_items.billing_type` (`ONE_TIME` / `RECURRING`) is stored on the line item, not
  inferred from the product — a product can be sold either way on a single order.
- `discount_evaluations` is append-only per evaluation run. Previous runs are never
  overwritten, preserving the full audit trail of every discount check.
- `approval_actions` stores every action per request (not just the latest decision) — full
  history per approval request.
- Money columns use `NUMERIC(14,2)` not `FLOAT` — avoids floating-point drift.

---

## Schema Checklist (applied to every table)

```
[x] Primary key defined (UUID, gen_random_uuid())
[x] Foreign keys explicit with ON DELETE behavior
[x] Required columns have NOT NULL
[x] Enum-like columns have CHECK constraints
[x] updated_at auto-set via set_updated_at() trigger
[x] Indexes on all FK columns
[x] Indexes on all frequent WHERE columns (status, created_at)
[x] No SELECT * in any query (select only required columns)
[x] No business logic encoded in schema
```

---

## Table Overview — 41 Tables

### Core RBAC (Migration 003)

| Table | Description |
|-------|-------------|
| `roles` | 6 roles: `SALES_REP`, `SALES_MANAGER`, `FINANCE`, `OPERATIONS`, `CUSTOMER`, `ADMIN` |
| `permissions` | Individual permission records |
| `role_permissions` | Many-to-many junction |
| `users` | All internal and portal users. Email is `CITEXT` (case-insensitive unique). `password_hash` never plaintext. `customer_id` (nullable FK to `customers`) is the portal-tenant link — NULL for internal staff, set for CUSTOMER-role portal users. |

### Customers (Migration 004)

| Table | Description |
|-------|-------------|
| `customers` | Company accounts with `customer_tier_id` |
| `customer_tiers` | e.g. Gold, Silver, Bronze — drives discount ceiling lookup |
| _(portal link)_ | Portal access is `users.customer_id` (FK to `customers`) directly — the earlier standalone `customer_users` junction table was folded into that column by the 2026-09-05 schema refactor |
| `price_lists` | Named price lists |
| `price_list_items` | Per-product price overrides within a price list |

### Products (Migration 005)

| Table | Description |
|-------|-------------|
| `product_categories` | Supports nesting via `parent_category_id` |
| `products` | SKU, price, unit type, linked to category |

### Quotations (Migration 006)

| Table | Description |
|-------|-------------|
| `quotations` | Central business object. 11 CHECK-constrained statuses: `DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT_TO_CUSTOMER`, `NEGOTIATION`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`, `CONVERTED` |
| `quotation_items` | Line items with `discount_percent`, `billing_type` (`ONE_TIME`/`RECURRING`). Quantity is `NUMERIC` (not integer) to support fractional units like kg/hours |

### Discount Engine (Migration 007)

| Table | Description |
|-------|-------------|
| `discount_rules` | Scope columns (`product_id`, `category_id`, `customer_tier_id`) are all nullable. A rule can match by product, category, tier, or globally. The **strictest** (minimum `max_discount`) applicable rule wins |
| `discount_evaluations` | Append-only result per item per check run. Never overwritten. Stores `requested_discount`, `allowed_discount`, `over_by`, `risk_score`, `risk_level`, `decision` |
| `approval_levels` | Configurable chain levels (e.g. Sales Manager, Finance) with `risk_level` trigger |

### Approvals (Migration 008)

| Table | Description |
|-------|-------------|
| `approval_requests` | One per check-discounts run that returned MEDIUM or HIGH risk |
| `approval_actions` | Full history of every APPROVE/REJECT/ESCALATE/RETURN action on a request |

### Negotiations (Migration 009)

| Table | Description |
|-------|-------------|
| `negotiations` | Thread header per quotation |
| `negotiation_messages` | Individual messages (`COMMENT`, `COUNTER_OFFER`, `ACCEPTANCE`, `REJECTION`) |
| `negotiation_changes` | Field-level diff record per pricing edit during negotiation |

### Recommendations (Migration 010)

| Table | Description |
|-------|-------------|
| `recommendation_rules` | Upsell/cross-sell rules with `type` (`UPSELL`/`CROSS_SELL`), `priority`, margin threshold filter |

### Sales Orders (Migration 011)

| Table | Description |
|-------|-------------|
| `sales_orders` | 1:1 with `quotations` (unique FK). Created on conversion |
| `sales_order_items` | Copied from `quotation_items` at conversion time |

### Warehouses & Inventory (Migration 012)

| Table | Description |
|-------|-------------|
| `warehouses` | Physical warehouse locations with `shipping_cost` |
| `inventory` | Current stock level per `(product_id, warehouse_id)` |

### Fulfillment (Migration 013–014)

| Table | Description |
|-------|-------------|
| `fulfillments` | One fulfillment plan per sales order |
| `fulfillment_items` | Per-warehouse allocation per product |
| `backorders` | Unfulfilled remainder rows |

### Billing (Migrations 015–018)

| Table | Description |
|-------|-------------|
| `invoices` | One-time billing: one invoice per order (or per billing-confirm run) |
| `invoice_items` | Line items per invoice |
| `payments` | Payment records against an invoice. `status = REFUNDED` for mid-cycle cancellation |
| `subscriptions` | Recurring billing: one subscription per recurring-type order |
| `subscription_items` | Recurring line items |
| `billing_schedules` | Scheduled charge dates for recurring billing |

### Deal Health (Migration 019)

| Table | Description |
|-------|-------------|
| `deal_health_scores` | Historical score per quotation (append-only, never overwritten) |
| `deal_alerts` | Three independent alert types: `STALLED`, `DISCOUNT_ANOMALY`, `DELIVERY_SLIPPAGE` |

### Notifications (Migration 020)

| Table | Description |
|-------|-------------|
| `notifications` | System-generated user notifications |

### Audit Logs (Migration 021)

| Table | Description |
|-------|-------------|
| `audit_logs` | Immutable record of every significant action: actor, timestamp, entity, before/after value, reason |

---

## Key Relationships

```
customers ──── customer_tiers
     │
     └── quotations ──── users (sales_rep_id)
              │
              ├── quotation_items ──── products ──── product_categories
              │         │
              │         └── discount_evaluations
              │
              ├── approval_requests ──── approval_actions
              ├── negotiations ──── negotiation_messages
              │                └── negotiation_changes
              │
              └── sales_orders
                      │
                      ├── fulfillments ──── fulfillment_items ──── warehouses
                      │               └── backorders
                      │
                      ├── invoices ──── payments
                      └── subscriptions ──── billing_schedules
```

---

## Index Strategy

Every migration indexes:
- All FK columns (lookup performance)
- `status` columns (all major list endpoints filter by status)
- `created_at` / `updated_at` on tables with time-based queries
- Composite indexes on `(product_id, warehouse_id)` for inventory lookups

---

## Query Considerations

- **N+1 prevention:** Repositories use JOIN queries or `WHERE id = ANY($1)` array lookups — never load a list then loop individual fetches
- **Pagination:** `LIMIT` + `OFFSET` via `getPaginationParams` utility
- **Reporting:** Aggregate queries directly over `quotations`/`quotation_items`/`invoices` — no separate reporting data model
- **Audit trail:** `audit_logs` is append-only; `discount_evaluations` is append-only

---

## Seeding

```bash
cd backend && npm run seed
```

Migration 022 seeds reference data (roles, permissions, default approval levels).
The `seed.js` script adds demo customers, products, and users. **Production-guarded.**

---

*Last updated: Phase 0 complete — DealFlow360 (41-table schema, 21 migrations)*
