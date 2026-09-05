# Official Problem Statement — DealFlow360

## Problem Statement

DealFlow360 is a self-governing B2B sales platform where quotations auto-route for approval
based on tiered/categorical discount rules, fulfillment auto-splits across warehouses, billing
handles one-time and recurring lines on a single order, and customers negotiate through an
isolated portal that can silently re-trigger approval.

**One-line problem:** Give sales reps a quote-to-cash flow where discount governance,
multi-warehouse fulfillment, hybrid billing, and customer negotiation all enforce themselves
server-side, without a manager having to manually watch every deal.

## Target Users

- **Rep** — builds quotations, negotiates internally, hands off approved deals to fulfillment/billing.
- **Manager** — reviews and approves/rejects quotations that breach discount ceilings.
- **Customer** — views quotes and negotiates discounts through an isolated portal.
- **Admin** — configures ceilings, warehouses, subscription plans, and upsell rules that everything else depends on.

## Primary User Journeys

1. **Rep journey:** login → build quote → discount breaches ceiling → auto-routes to approval → approved → warehouse split suggested → confirmed → billed.
2. **Manager journey:** login → approvals queue → reviews blended risk breakdown → approve/reject/return.
3. **Customer journey:** magic link → views quote → counters discount → confirms → (invisibly) may re-enter approval → sees final confirmed status.
4. **Admin journey:** configures ceilings, warehouses, subscription plans, upsell rules before any of the above can function correctly.

## Core Features

- Product / price-list / customer management with tier assignment
- Discount rule engine (tier + category ceilings)
- Blended risk scoring with multi-step approval workflow and immutable audit log
- Warehouse split / fulfillment allocation with backorder handling
- Hybrid billing (one-time invoices + recurring subscriptions with proration)
- Isolated customer negotiation portal that can re-trigger approval
- Upsell / cross-sell suggestions
- Deal health flags (stalled / discount anomaly / delivery slippage)
- Filterable reporting with export

## Optional / Stretch Features

- Logistic-regression-based discount risk scoring (v2, on top of the v1 rule-based formula)
- PDF/XLS report export formatting
- Auto-consolidate-on-restock for backordered fulfillment splits
- Credit-note auto-generation on subscription cancellation

## Edge Cases

- Customer counter-discount on the portal breaches the ceiling a second time → must silently re-enter the approval workflow rather than auto-confirming.
- A quotation line's discount is within the tier ceiling but over the category ceiling (or vice versa) → the engine must apply the **stricter** of the two.
- A warehouse split leaves a remainder that cannot be fulfilled from any warehouse → must produce a backorder rather than failing silently.
- Subscription proration when a plan changes mid-cycle.
- Portal user attempting to access a quotation that does not belong to their customer account → must be blocked at the query level, not just the UI.

## Initial Notes

Phase 0 analysis complete for DealFlow360 (see `requirements.md`, `architecture.md`,
`technology-decisions.md`, and `database/schema/er-diagram.md`). Execution follows the
24-hour roadmap: Foundation → Discount Engine + Approvals → Fulfillment + Billing →
Customer Portal + Re-Approval Loop → Upsell + Deal Health → Reporting/Rehearsal.

---

*Last updated: Phase 0 complete — DealFlow360*
