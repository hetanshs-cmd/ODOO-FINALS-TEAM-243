# ER Diagram — DealFlow360

## Database-First Approach

This project follows the principle: **design the database before writing backend code**.

> This is the definitive DealFlow360 schema (41 tables). It supersedes the earlier
> draft schema (customer_portal_users / discount_ceilings / quotation_lines naming) —
> that draft is retired in favor of the table names and structure below.

---

## Entities

Grouped by dependency order (see Migration Files below for the numbered-file mapping).

### RBAC (Identity & Access)

**`roles`** — id PK, name (unique: `SALES_REP`, `SALES_MANAGER`, `FINANCE`, `OPERATIONS`,
`CUSTOMER`, `ADMIN`), description, created_at, updated_at

**`permissions`** — id PK, name unique, description, created_at, updated_at

**`role_permissions`** — id PK, role_id FK → roles.id, permission_id FK → permissions.id,
created_at · `UNIQUE(role_id, permission_id)`

**`users`** — id PK, name, email unique, password_hash, phone, status, role_id FK → roles.id,
created_at, updated_at, last_login_at · indexed on `role_id`, `status`

### Customers

**`customer_tiers`** — id PK, name unique, description, discount_limit
(`0 <= x <= 100`), priority (`>= 0`), status, created_at, updated_at

**`customers`** — id PK, company_name, customer_code unique, customer_tier_id FK →
customer_tiers.id, industry, tax_id, email, phone, website, status, created_at, updated_at ·
indexed on `customer_tier_id`, `status`

**`customer_users`** — id PK, customer_id FK → customers.id, user_id FK → users.id,
designation, status, created_at, updated_at · `UNIQUE(customer_id, user_id)`. This is the
**tenant-isolation table for the customer portal** — a customer user must only access data
belonging to its associated `customer_id`; the backend authorization layer enforces this on
every query, never the frontend alone.

**`addresses`** — id PK, customer_id FK → customers.id, type (`BILLING`/`SHIPPING`/`OFFICE`),
address_line_1, address_line_2, city, state, country, postal_code, is_default, created_at,
updated_at · indexed on `customer_id`, `type`

### Products

**`product_categories`** — id PK, name, description, parent_category_id FK →
product_categories.id (self-reference for nested categories, `parent_category_id <> id`),
created_at, updated_at

**`products`** — id PK, sku unique, name, description, category_id FK →
product_categories.id, product_type (`ONE_TIME`/`RECURRING`), base_price (`>= 0`),
cost_price (`>= 0`), unit, status, created_at, updated_at · indexed on `category_id`, `status`

**`price_lists`** — id PK, name, currency, customer_tier_id FK → customer_tiers.id, valid_from,
valid_until (`>= valid_from` when present), status, created_at, updated_at

**`price_list_items`** — id PK, price_list_id FK → price_lists.id, product_id FK →
products.id, price (`>= 0`), min_quantity (`> 0`), max_quantity (`>= min_quantity`),
created_at, updated_at · `UNIQUE(price_list_id, product_id)`

### Quotations — the central business object

**`quotations`** — id PK, quotation_number unique, customer_id FK → customers.id,
sales_rep_id FK → users.id, price_list_id FK → price_lists.id (nullable), status, currency,
subtotal/discount_total/tax_total/grand_total (all `>= 0`), valid_until, created_at,
updated_at · indexed on `customer_id`, `sales_rep_id`, `price_list_id`, `status`, `created_at`

Statuses: `DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`,
`SENT_TO_CUSTOMER`, `NEGOTIATION`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`, `CONVERTED`

**`quotation_items`** — id PK, quotation_id FK → quotations.id, product_id FK → products.id,
description, quantity (`> 0`), unit_price (`>= 0`), discount_percent (`0-100`),
discount_amount (`>= 0`), tax_percent (`0-100`), line_total (`>= 0`), billing_type
(`ONE_TIME`/`RECURRING`), created_at, updated_at · indexed on `quotation_id`, `product_id`

### Discount Engine

**`discount_rules`** — id PK, name, priority (`>= 0`), product_id / category_id /
customer_tier_id FK (all nullable — a rule may apply at any combination of scopes), sales_role,
min_discount / max_discount (`0-100`, `max >= min`), approval_required, approval_level,
active, created_at, updated_at

**`discount_evaluations`** — id PK, quotation_id FK → quotations.id, quotation_item_id FK →
quotation_items.id (nullable), requested_discount / allowed_discount (`0-100`), risk_score
(`0-100`), risk_level (`LOW`/`MEDIUM`/`HIGH`), decision (`AUTO_APPROVED`/
`REQUIRES_APPROVAL`/`REJECTED`), evaluated_at, created_at · **append-only — historical
evaluations are never overwritten.**

### Approval Engine

**`approval_levels`** — id PK, name unique, level unique (`> 0`), description, created_at,
updated_at

**`approval_requests`** — id PK, quotation_id FK → quotations.id, requested_by FK → users.id,
assigned_to FK → users.id (nullable), approval_level FK → approval_levels.id, status
(`PENDING`/`APPROVED`/`REJECTED`/`ESCALATED`/`CANCELLED`), reason, requested_at, responded_at,
created_at, updated_at

**`approval_actions`** — id PK, approval_request_id FK → approval_requests.id, user_id FK →
users.id, action, comment, created_at. Stores full approval **history**, not just the latest
decision.

### Negotiation

**`negotiations`** — id PK, quotation_id FK → quotations.id, initiated_by FK → users.id,
status, created_at, closed_at

**`negotiation_messages`** — id PK, negotiation_id FK → negotiations.id, sender_user_id FK →
users.id, message, message_type, created_at

**`negotiation_changes`** — id PK, negotiation_id FK → negotiations.id, quotation_item_id FK →
quotation_items.id (nullable), field_name, old_value, new_value, changed_by FK → users.id,
created_at. Critical for detecting whether a negotiation changed pricing/discounts beyond
approval thresholds — the wiring point for the re-approval loop.

### Upsell / Cross-Sell

**`recommendation_rules`** — id PK, source_product_id / recommended_product_id FK →
products.id (`source <> recommended`), recommendation_type (`UPSELL`/`CROSS_SELL`), priority,
reason, status, created_at, updated_at · `UNIQUE(source_product_id, recommended_product_id,
recommendation_type)`

### Sales Orders

**`sales_orders`** — id PK, order_number unique, quotation_id FK → quotations.id (**unique** —
one order per quotation), customer_id FK → customers.id, sales_rep_id FK → users.id, status,
subtotal/discount_total/tax_total/grand_total (`>= 0`), order_date, created_at, updated_at

**`sales_order_items`** — id PK, sales_order_id FK → sales_orders.id, product_id FK →
products.id, quantity (`> 0`), unit_price (`>= 0`), discount (`>= 0`), total (`>= 0`),
fulfilled_quantity / backordered_quantity (`>= 0`, each `<= quantity`), created_at, updated_at

### Warehouses & Inventory

**`warehouses`** — id PK, name, code unique, address_id FK → addresses.id (nullable),
manager_id FK → users.id (nullable), status, created_at, updated_at

**`inventory`** — id PK, warehouse_id FK → warehouses.id, product_id FK → products.id,
quantity_on_hand / quantity_reserved / quantity_available / reorder_level (`>= 0`,
`reserved <= on_hand`), created_at, updated_at · `UNIQUE(warehouse_id, product_id)`

### Fulfillment

**`fulfillments`** — id PK, sales_order_id FK → sales_orders.id, warehouse_id FK →
warehouses.id, status, scheduled_date, fulfilled_date, created_at, updated_at

**`fulfillment_items`** — id PK, fulfillment_id FK → fulfillments.id, sales_order_item_id FK →
sales_order_items.id, quantity (`> 0`), status, created_at, updated_at. Supports splitting one
sales order line across multiple warehouses.

### Backorders

**`backorders`** — id PK, sales_order_id FK → sales_orders.id, sales_order_item_id FK →
sales_order_items.id, product_id FK → products.id, quantity (`> 0`), status (`OPEN`/
`PARTIALLY_FULFILLED`/`FULFILLED`/`CANCELLED`), expected_date, created_at, fulfilled_at

### Billing

**`invoices`** — id PK, invoice_number unique, customer_id FK → customers.id, sales_order_id
FK → sales_orders.id (nullable), quotation_id FK → quotations.id (nullable — recurring
invoices come from `billing_schedules` instead), invoice_type (`ONE_TIME`/`RECURRING`),
status, subtotal/discount_total/tax_total/total (`>= 0`), due_date, issued_at, paid_at,
created_at, updated_at

**`invoice_items`** — id PK, invoice_id FK → invoices.id, product_id FK → products.id
(nullable), description, quantity (`> 0`), unit_price (`>= 0`), tax (`>= 0`), total (`>= 0`),
created_at, updated_at

### Payments

**`payments`** — id PK, invoice_id FK → invoices.id, customer_id FK → customers.id, amount
(`> 0`), payment_method, transaction_reference (unique when present), status (`PENDING`/
`SUCCESS`/`FAILED`/`REFUNDED`), paid_at, created_at, updated_at

### Subscriptions

**`subscription_plans`** — id PK, name unique, description, billing_frequency (`MONTHLY`/
`QUARTERLY`/`YEARLY`), price (`>= 0`), trial_days (`>= 0`), status, created_at, updated_at

**`subscriptions`** — id PK, customer_id FK → customers.id, sales_order_id FK →
sales_orders.id (nullable), quotation_id FK → quotations.id (nullable), plan_id FK →
subscription_plans.id, status (`ACTIVE`/`CANCELLED`/`MODIFIED`), start_date, end_date
(`>= start_date`), next_billing_date, current_price (`>= 0`), created_at, updated_at

**`subscription_items`** — id PK, subscription_id FK → subscriptions.id, product_id FK →
products.id, quantity (`> 0`), unit_price (`>= 0`), created_at, updated_at

### Billing Schedules

**`billing_schedules`** — id PK, subscription_id FK → subscriptions.id, billing_date, amount
(`>= 0`), status, invoice_id FK → invoices.id (nullable), created_at, updated_at. Drives
recurring invoice generation each cycle.

### Deal Health

**`deal_health_scores`** — id PK, quotation_id FK → quotations.id (**not unique** — score
history is preserved, never overwritten), score / discount_risk / negotiation_risk /
delay_risk / fulfillment_risk (all `0-100`), risk_level, calculated_at, created_at

**`deal_alerts`** — id PK, quotation_id FK → quotations.id, alert_type (`STALLED`/
`DISCOUNT_ANOMALY`/`DELIVERY_SLIPPAGE`), severity, message, status (`OPEN`/`ESCALATED`/
`NUDGED`/`RESOLVED`), created_at, resolved_at

### Notifications

**`notifications`** — id PK, user_id FK → users.id, type, title, message, reference_type /
reference_id (logical pointer to a quotation/order/invoice/etc. — **not** a polymorphic DB
FK), is_read, created_at, updated_at

### Audit Logs

**`audit_logs`** — id PK, user_id FK → users.id (nullable — log survives user deletion),
action, entity_type, entity_id, old_value / new_value (jsonb), ip_address, created_at.
**Append-oriented** — application code must never update or delete audit history.

---

## Relationships

```
ROLE
 └── USERS
      ├── CUSTOMER_USERS ─── CUSTOMER
      ├── QUOTATIONS
      ├── SALES_ORDERS
      ├── APPROVAL_REQUESTS
      ├── NEGOTIATIONS
      ├── NOTIFICATIONS
      └── AUDIT_LOGS

CUSTOMER
 ├── CUSTOMER_TIER
 ├── CUSTOMER_USERS
 ├── ADDRESSES
 ├── QUOTATIONS
 ├── SALES_ORDERS
 ├── INVOICES
 ├── PAYMENTS
 └── SUBSCRIPTIONS

PRODUCT_CATEGORY
 └── PRODUCTS
      ├── PRICE_LIST_ITEMS
      ├── QUOTATION_ITEMS
      ├── SALES_ORDER_ITEMS
      ├── INVENTORY
      ├── INVOICE_ITEMS
      ├── SUBSCRIPTION_ITEMS
      ├── DISCOUNT_RULES
      └── RECOMMENDATION_RULES

QUOTATION
 ├── QUOTATION_ITEMS
 ├── DISCOUNT_EVALUATIONS
 ├── APPROVAL_REQUESTS
 ├── NEGOTIATIONS
 ├── DEAL_HEALTH_SCORES
 ├── DEAL_ALERTS
 ├── SALES_ORDER (0..1, unique FK)
 └── INVOICES

NEGOTIATION
 ├── NEGOTIATION_MESSAGES
 └── NEGOTIATION_CHANGES

SALES_ORDER
 ├── SALES_ORDER_ITEMS
 ├── FULFILLMENTS
 ├── BACKORDERS
 └── INVOICES

WAREHOUSE
 ├── INVENTORY
 └── FULFILLMENTS

INVOICE
 ├── INVOICE_ITEMS
 ├── PAYMENTS
 └── BILLING_SCHEDULES

SUBSCRIPTION
 ├── SUBSCRIPTION_ITEMS
 └── BILLING_SCHEDULES
       └── INVOICE
```

Discount check applies the **strictest applicable** `discount_rules` row across the scopes
that match a line (product / category / customer tier) — see `requirements.md` FR2.

---

## Foreign Key Delete/Update Strategy

- **Master/configuration data** (roles, permissions, products, customer tiers, price lists,
  approval levels) — `RESTRICT`: prevent deleting a row that's still referenced.
- **Dependent transactional records** — `CASCADE` only when deleting the parent should
  logically delete the child without destroying required business history (e.g. line items
  under their parent quotation/order/invoice; junction tables like `role_permissions`,
  `customer_users`). Business-critical top-level records (quotations, approval requests,
  negotiations) use `RESTRICT` on their own FKs so they're never silently cascaded away.
- **Optional relationships** — `SET NULL` (e.g. `approval_requests.assigned_to`,
  `warehouses.manager_id`, `invoices.quotation_id`, `invoices.sales_order_id`,
  `subscriptions.sales_order_id`/`quotation_id`, `discount_rules` scope columns).

---

## Customer Portal Data Isolation

Tenant isolation flows through `customer_users.customer_id`. Every customer-owned business
record must be traceable to `customers.id`. Customer users must **not** be able to access
other customers' data, internal approval comments, internal discount rules, internal
deal-health calculations, internal audit logs, or other reps' data — enforced by the backend
authorization layer on every query, never by hiding records in the frontend alone.

---

## Migration Files

All schema changes live in `backend/migrations/`, one numbered SQL file per group above,
run through the existing `scripts/migrate.js` runner. `001_initial_schema.sql` is already
committed and is never hand-edited — new tables are added via new numbered migrations in the
dependency order listed above (RBAC → Customers → Products → Quotations → Discount Engine →
Approvals → Negotiation → Recommendations → Sales Orders → Warehouses/Inventory →
Fulfillment/Backorders → Billing → Payments → Subscriptions → Billing Schedules →
Deal Health → Notifications → Audit Logs).

---

*Last updated: Phase 0 complete — DealFlow360 (definitive 41-table schema)*
