# ER Diagram — DealFlow360

## Database-First Approach

This project follows the principle: **design the database before writing backend code**.

---

## Entities

Grouped by the migration file that will create them (see Migration Files below).

```
IDENTITY (002_identity.sql)
────────────────────────────
users                    — internal reps/managers/admins (role-based)
customers                — B2B accounts, tier assignment
customer_portal_users    — portal-only auth, fully isolated from `users`

CATALOG (003_catalog.sql)
────────────────────────────
categories
products                 — belongs to a category
product_variants
price_lists
price_list_items         — product/variant price per price_list

DISCOUNT GOVERNANCE (004_discount_governance.sql)
────────────────────────────
discount_ceilings        — per tier AND per category ceiling
approval_chain_rules     — maps risk score → 0/1/2-step approval chain

QUOTATIONS (005_quotations.sql)
────────────────────────────
quotations               — header: customer, rep, status
quotation_lines          — product/variant, qty, discount %, category (denormalized for ceiling checks)
approval_steps           — one row per step in a quotation's approval chain
audit_log                — immutable, append-only, one row per approval action

UPSELL (006_upsell.sql)
────────────────────────────
copurchase_pairs         — product A + product B co-purchase frequency
promotions
upsell_config            — margin threshold, ranking weights

FULFILLMENT (007_fulfillment.sql)
────────────────────────────
warehouses
stock_levels              — product/variant x warehouse
fulfillment_splits        — quotation_line → warehouse allocation, backorder flag

BILLING (008_billing.sql)
────────────────────────────
subscription_plans
subscriptions             — customer, plan, next_bill_date
billing_lines             — one-time vs. recurring, linked to a quotation_line
invoices
credit_notes

PORTAL (009_portal.sql)
────────────────────────────
negotiation_messages      — comment/counter-discount thread, scoped to customer_portal_users

DEAL HEALTH (010_deal_health.sql)
────────────────────────────
deal_health_flags         — type (stalled | discount_anomaly | slippage), quotation_id, raised_at
```

---

## Relationships (key FKs)

```
customers 1─* quotations
quotations 1─* quotation_lines
quotations 1─* approval_steps
approval_steps 1─* audit_log
quotation_lines 1─* fulfillment_splits
fulfillment_splits *─1 warehouses
quotation_lines 1─* billing_lines
billing_lines *─1 invoices | subscriptions
customer_portal_users 1─* negotiation_messages (scoped to their own customer_id — row-level ownership check on every query, per NFR2)
quotations 1─* deal_health_flags
```

Discount ceiling check applies the **stricter** of `discount_ceilings` rows matching
(customer tier) and (quotation_line category) — see `requirements.md` FR2.

---

## Migration Files

All schema changes live in `backend/migrations/`, one numbered file per group above.
`001_initial_schema.sql` is already committed and is never hand-edited; new entities are
added via `002_identity.sql` through `010_deal_health.sql`, run through the existing
`scripts/migrate.js` runner.

---

*Last updated: Phase 0 complete — DealFlow360*
