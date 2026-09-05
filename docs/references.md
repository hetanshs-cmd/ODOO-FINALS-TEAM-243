# Architectural References — DealFlow360

> Consult this file before designing or implementing any module below. These five
> repositories are proven, production-grade implementations of patterns DealFlow360 needs.
> The goal is to **borrow patterns, not code** — none of these match our schema, so nothing
> here is meant to be copy-pasted; each entry says which of our modules it informs and what
> specifically to look at.

Ranked by relevance to DealFlow360.

---

## 1. Medusa — https://github.com/medusajs/medusa

**Relevance: highest — commerce domain modeling + orchestration.**

- **Workflows pattern.** Medusa models multi-step commerce operations (e.g. place order →
  reserve inventory → charge payment → fulfill) as a **Workflows SDK**: a named sequence of
  steps, each with an optional compensation ("undo") function that runs automatically if a
  later step fails. This is the direct model for our chain: `check-discounts` →
  create-`approval_requests` → convert-to-`sales_orders` → `suggest-fulfillment`. If a step
  fails partway (e.g. fulfillment suggestion errors after a sales order was created), a
  workflow-style rollback keeps the DB consistent instead of leaving orphaned rows.
  **Apply to:** `discount-engine`, `approvals`, `sales-orders`/`fulfillment` modules.
- **Pricing module.** Price lists scoped to a customer group, with rule-based overrides.
  Structurally the same "which rule applies, and which wins when several match" problem as
  our `discount_rules` (nullable product/category/customer_tier scope columns, strictest
  wins). Worth skimming how they resolve rule precedence when multiple price rules match one
  line item.
  **Apply to:** `discount-engine`, `admin` (price-list/discount-rule config).
- **Fulfillment module.** Multi-stock-location orders, pluggable fulfillment providers.
  More flexible than we need (we don't need pluggable providers), but confirms the
  data shape: an order's line items map to N (location, quantity) allocations.
  **Apply to:** `fulfillment` (warehouse-split algorithm).

## 2. Directus — https://github.com/directus/directus

**Relevance: highest — RBAC + tenant isolation.**

- **Policy-based, field/row-level permissions.** Every request — human or API caller — goes
  through the same permission layer; there is no special-cased "internal" bypass. This is
  exactly the discipline NFR2 demands for the customer portal: `customer_users` scoping must
  be enforced as a permission policy applied uniformly, not an if-branch bolted onto portal
  controllers.
  **Apply to:** `auth`/`portal` modules — model portal access as a policy scoped to
  `customer_id`, applied the same way regardless of which endpoint is called.
- **Flows (event-triggered automations).** Directus lets you attach an automation to a DB
  event ("on this collection's create/update, run this action"). Good structural reference
  for our `node-cron` deal-health job and the negotiation re-approval trigger — treat
  "re-run `check-discounts` when a negotiation changes a price" as a triggered flow, not
  logic scattered across controllers.
  **Apply to:** `deal-health`, `negotiations` (re-approval trigger).
- **Auto-generated REST/GraphQL CRUD from schema.** Not something to replicate exactly (we
  hand-write controllers per our layered-monolith convention), but a useful sanity check for
  the `admin/*` CRUD surface — Directus's admin data model (collections, fields, relations)
  maps onto our `products`/`price_lists`/`discount_rules`/`warehouses`/etc. admin screens.
  **Apply to:** `admin` module, Admin Reporting/Config screens.

## 3. Strapi — https://github.com/strapi/strapi

**Relevance: high — layering + admin RBAC, confirms our existing scaffold.**

- **Routes → Middlewares → Controllers → Services.** This is *already* our scaffold's
  layering (`docs/architecture.md` § Backend Layer Responsibilities) — Strapi is confirmation
  we're not off the beaten path, not a source of new patterns here.
- **Roles & Permissions plugin.** Fine-grained, per-resource role permissions with a
  dedicated permissions layer separate from business logic. Reference this when building the
  `roles`/`permissions`/`role_permissions` tables' enforcement — permission checks should be
  a middleware/guard layer, not scattered `if (user.role === 'ADMIN')` checks in controllers.
  **Apply to:** `auth` module (role-guard middleware), `admin` CRUD.
- **Content-Type Builder.** A visual schema-definition UI — out of scope for a 24h hackathon,
  but the underlying idea (one consistent CRUD pattern generated per entity) is why our
  `admin/*` endpoints should share one generic CRUD controller/service shape rather than
  bespoke code per resource.
  **Apply to:** `admin` module.

## 4. Ghost — https://github.com/TryGhost/Ghost

**Relevance: narrow — subscription billing only.**

- **Members + Stripe subscription billing.** Ghost's paid-newsletter billing is a working,
  real implementation of recurring charges, proration on plan change, and webhook-driven
  status sync — the same shape as our `subscriptions`/`billing_schedules` proration formula
  (`days_remaining_in_cycle / total_days_in_cycle * price_delta`).
  **Apply to:** `billing` module, specifically `PATCH /subscriptions/:id` proration and
  cancellation/refund handling. Skip everything else in this repo (CMS/publishing is
  irrelevant to DealFlow360).

## 5. React-Inventory-Management-System — https://github.com/mhamzashaikh/React-Inventory-Management-System

**Relevance: low — quick UI layout reference only.**

- A small MERN (React + Express + MongoDB) inventory CRUD app. Not architecturally rich and
  not relational (no multi-warehouse split, no backorders), so **don't borrow its data
  model**. Useful only as a fast starting layout for the Fulfillment List/Detail screens if
  time is short — a warehouse/stock table + a simple form, nothing more.
  **Apply to:** Fulfillment List/Detail screen layout (frontend only), lowest priority.

---

## How to use this file

- When starting work on `discount-engine`, `approvals`, or `sales-orders`/`fulfillment` →
  re-read the **Medusa** entry first (Workflows pattern, Pricing module).
- When starting work on `auth`, `portal`, or `admin` RBAC → re-read the **Directus** and
  **Strapi** entries (policy-based permissions, roles/permissions layering).
- When starting work on `billing`/subscriptions → re-read the **Ghost** entry.
- When starting work on Fulfillment screens and time is short → skim the **React Inventory
  Management System** entry for a layout starting point.
- None of these repos should be cloned or vendored into this project — reference their
  public docs/READMEs for the pattern, then implement it against our own schema
  (`database/schema/er-diagram.md`) and layering (`docs/architecture.md`).

---

*Last updated: Phase 0 complete — DealFlow360*
