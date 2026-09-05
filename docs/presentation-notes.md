# Presentation Notes — DealFlow360

> Every team member must read this and practice explaining their module out loud before demo.

---

## Project Overview

**Problem:**
B2B sales teams lose deals to slow manual approval processes, inconsistent discount enforcement,
and disconnected fulfillment/billing systems. Managers manually chase every over-discounted deal.

**DealFlow360 solves this:** Discount governance, multi-warehouse fulfillment, hybrid billing,
and customer negotiation all enforce themselves server-side — automatically, on every action.

**Target Users:**
- **Sales Rep** — builds quotes, negotiates internally
- **Sales Manager** — reviews approvals queue, approves/rejects
- **Customer** — negotiates via isolated portal
- **Admin** — configures ceilings, warehouses, subscription plans

**Core Flow:**
```
Rep builds quote → Discount checked → Over-limit? → Auto-routes to approval
  → Manager approves → Warehouse split suggested → Confirmed → Billing split
  → Customer negotiates in portal → Counter-offer re-checks discount → May re-enter approval
```

**Stack Justification:**
- Node.js + Express + TypeScript: rule-heavy service layer, team has scaffold, fast to iterate
- PostgreSQL: FK-heavy domain (approvals, billing splits, audit trail) — relational by nature
- React + Vite: two isolated route trees, fast dev-server
- No Firebase/Supabase: hard constraint — team owns backend and database

---

## Quick Test Flow (Demo Script)

> Practice this 8-step flow verbatim at least twice before presenting.

1. **Admin** configures a discount ceiling (e.g. Hardware category: max 15%)
2. **Admin** sets up warehouses with inventory levels
3. **Sales Rep** logs in → creates a quotation → adds a Hardware product → sets discount to 18%
4. `check-discounts` fires → blended score HIGH → `approval_requests` created → status `PENDING_APPROVAL`
5. **Manager** logs in → sees approval in queue → views risk breakdown → **Approves**
6. Quotation converts to sales order → warehouse split suggested → Rep accepts
7. Billing confirm → Hardware item (ONE_TIME) → invoice created; if any RECURRING item → subscription created
8. **Customer** logs in via magic link → views quote in portal → submits counter-discount of 20% → on Confirm → re-runs check-discounts → back to `PENDING_APPROVAL` → Manager's queue again

---

## Feature Explainers

### Feature: Discount Rule Engine (FR2 + FR3)

**Problem Solved:**
Reps could previously offer any discount with no guardrails. Managers had to manually review every deal.

**How It Works:**
1. Rep edits a `quotation_items` row with a `discount_percent`
2. Frontend calls `POST /api/v1/quotations/:id/check-discounts`
3. Engine (`discountEngine.ts`) is a **pure function** — no I/O, fully unit-testable:
   - For each item: finds every active `discount_rules` row matching by product, category, or tier
   - Takes `Math.min()` of all matching ceilings → **strictest wins**
   - Safe default: no matching rule → ceiling = 0 (no discount without explicit admin config)
   - Computes `overBy = max(0, requestedDiscount - ceiling)`
4. Blended score across the whole quotation: `worstOverage*2 + totalOverage*0.5 + violationCount*5`
5. Risk level: 0=LOW (auto-approved), ≤30=MEDIUM (routes to Sales Manager), >30=HIGH (routes to Finance)
6. Entire persist step (evaluations + status + approval_request) runs in one DB transaction via `withTransaction` — partial failures roll back cleanly

**Architecture:**
Route → Controller → `discountEngineService.checkDiscounts()` → pure `evaluateQuotationDiscounts()` → `withTransaction` → Repository

**Database:**
- `discount_rules`: nullable `product_id`, `category_id`, `customer_tier_id` — a rule can match any scope
- `discount_evaluations`: append-only, never overwritten — full history of every check
- `approval_requests`: created if risk ≠ LOW

**Key Reviewer Questions:**

| Question | Answer |
|----------|--------|
| What if a product has both a category rule and a tier rule? | The engine takes the minimum (strictest) ceiling — the harder limit wins |
| What if no rule exists for a product? | Ceiling defaults to 0 — any discount triggers approval. Safe-by-default, never silently unlimited |
| Why is the engine a pure function? | So it can be unit-tested against the spec's worked example before any DB wiring. No DB = fast, isolated, reproducible tests |
| What guarantees atomicity? | `withTransaction` wraps all writes (evaluations + status + approval_request) in a single `BEGIN`/`COMMIT`. Any failure triggers `ROLLBACK` |

---

### Feature: Authentication (Two Schemes)

**Internal login (`POST /api/v1/auth/login`):**
- bcrypt.compare(password, hash) — work factor 12
- Returns JWT with `{ sub, role, scope: "internal" }` — 15 min expiry
- Same error for wrong email, wrong password, inactive user — prevents enumeration

**Portal magic-link (`POST /api/v1/portal/request-link` → `POST /portal/verify-link`):**
- `crypto.randomBytes(32).toString('hex')` = 64-char one-time token
- Stored in in-memory Map with 15-min TTL
- `Map.delete(token)` on first lookup — prevents replay
- JWT issued with `scope: "portal"` + `customerId` claim
- `verifyPortalToken` throws if `scope !== "portal"` — prevents internal tokens being used on portal endpoints

**Key Reviewer Questions:**

| Question | Answer |
|----------|--------|
| Why same error for wrong email vs wrong password? | Prevents attacker discovering which emails are registered |
| Why not one auth scheme for both? | Portal users must be strictly isolated from internal staff. Separate JWT scope, separate middleware, no shared session. NFR2 is explicit about this |
| What happens if JWT_SECRET is weak? | Zod enforces min 32 chars at startup. Server refuses to start if the env var is missing or too short |
| Is the magic link stored in the DB? | Not yet (stub phase — in-memory Map). In production it would be a DB table with an expiry column so it survives server restarts |

---

### Feature: Approval Workflow (FR3 + FR4)

**Flow:**
1. `check-discounts` sets quotation to `PENDING_APPROVAL` + creates `approval_requests` row
2. Manager/Finance sees it in `GET /approvals?status=PENDING`
3. `POST /approvals/:id/act` with `{ action: "APPROVE"|"REJECT"|"RETURN"|"ESCALATE", comment }`
4. Inserts an `approval_actions` row (full history, not just latest) + `audit_logs` row (FR4)
5. `APPROVE` → quotation status = `APPROVED` → triggers fulfillment suggestion
6. `REJECT` → status = `REJECTED`
7. `RETURN` → status = `DRAFT` (back to rep)

**Key Reviewer Questions:**

| Question | Answer |
|----------|--------|
| Where is approval history stored? | `approval_actions` table — every APPROVE/REJECT/RETURN/ESCALATE is a row, not an overwrite |
| What is the audit log? | `audit_logs` table — immutable: actor, timestamp, entity, before/after value, reason |
| How are approval levels configured? | By Admin via `/admin/approval-levels`. MEDIUM risk → lowest level, HIGH risk → highest level. Dynamic, not hardcoded |

---

### Feature: Customer Portal (FR8 + FR9)

**Critical:** The portal is **not just hidden CSS** — it is a completely separate route tree with
its own auth middleware (`verifyPortalToken`) and every single query enforces `customer_id` match.

**Re-approval on confirm (FR9):**
```
POST /portal/quotations/:id/confirm
  → apply accepted negotiated discount_percent to quotation_items
  → re-run check-discounts (same pure engine function as FR2/FR3)
  → if risk != LOW: status = PENDING_APPROVAL → notification to manager
  → if risk == LOW: status = ACCEPTED → convert to sales order
```

**Key Reviewer Questions:**

| Question | Answer |
|----------|--------|
| How do you prevent a customer accessing another customer's quotation? | Row-level check on every query: `WHERE id = $1 AND customer_id = $2`. `customerId` comes from the JWT (unforgeable), not from client input |
| What triggers the re-approval? | The portal's confirm endpoint literally calls the same `discountEngineService.checkDiscounts()` function — it's not a separate code path |

---

### Feature: Fulfillment & Billing

**Warehouse split (FR6):**
- `POST /sales-orders/:id/suggest-fulfillment` runs a greedy allocation
- Sort warehouses by (stock desc, shipping_cost asc) — prefer fewer warehouses over marginal cost savings
- Any unfulfilled remainder → `backorders` row (not silent failure)

**Billing split (FR7):**
- `POST /sales-orders/:id/billing/confirm` iterates `sales_order_items`
- `billing_type = ONE_TIME` → `invoices` + `invoice_items`
- `billing_type = RECURRING` → `subscriptions` + `subscription_items` + `billing_schedules`
- Proration: `days_remaining_in_cycle / total_days * price_delta`

---

### Feature: Deal Health (FR10)

Three independent detectors run via `node-cron`:

1. **Stalled:** quotation not in terminal status + `updated_at` older than configured threshold
2. **Discount anomaly:** rep's discount exceeds their own historical average + σ threshold (rep-relative, not global)
3. **Delivery slippage:** fulfillment `scheduled_date < now()` and not shipped/cancelled

Each writes an independent `deal_alerts` row — not one composite score. This lets managers see exactly which risk type fired.

---

## Team Ownership Map

| Module | Owner | Reviewer |
|--------|-------|---------|
| Discount engine, approvals, portal re-approval | Backend-Lead | Architecture review |
| Admin CRUD, warehouse split, billing | Backend-Support | Backend-Lead |
| Quotation Builder, Upsell panel | Frontend-Lead | Architecture review |
| Approvals screens, Fulfillment, Billing, Portal Negotiation | Frontend-Support | Frontend-Lead |

---

## Final Demo Checklist

```
[ ] Docker Compose running — postgres health check passing
[ ] All 21 migrations applied (npm run migrate)
[ ] Seed data loaded: Gold customer, mixed Hardware+Services quote, rep user, manager user
[ ] demo quote: Hardware item at 18% (triggers MEDIUM risk against 15% ceiling)
[ ] demo quote: has at least one RECURRING item (tests billing split)
[ ] Full 8-step Quick Test Flow done at least twice end-to-end
[ ] Every team member can explain their module without notes
[ ] Every team member can answer security, database, and architecture questions
[ ] Backup: if portal magic-link email fails → devToken in response (non-production)
[ ] Branches merged: feature/* → dev → main only after full flow passes
```

---

## Common Reviewer Questions — With Answers

**Database**
- *Why PostgreSQL?* FK integrity across approval steps, billing splits, and the audit trail. The domain is relational by nature — not document-shaped.
- *Why no ORM?* Raw parameterized `pg` queries. Avoids introducing Prisma's migration system alongside our custom numbered migration runner.
- *How do you prevent N+1?* Repositories use JOIN queries and `WHERE id = ANY($1::uuid[])` array lookups.
- *Why NUMERIC(14,2) for money?* Avoids floating-point drift. `roundMoney()` helper in `shared/money.ts` enforces rounding before any parameter reaches SQL.

**Security**
- *How are passwords stored?* `bcrypt.hash(password, 12)` — work factor 12. Never plaintext.
- *How do you prevent SQL injection?* Every query uses `$1, $2` parameterized form. String concatenation into SQL is explicitly forbidden in AGENTS.md.
- *What if a JWT is stolen?* 15-minute expiry limits the window. Portal tokens are one-time-use (deleted on verify). In production: short-lived + refresh token rotation.
- *How do you prevent email enumeration?* Auth service always throws the same `INVALID_CREDENTIALS` error whether the email is unknown, the password is wrong, or the account is inactive.

**Architecture**
- *Why a monolith and not microservices?* Fastest to build in 24h, easiest for a 4-person team to debug under pressure, and there's no genuine scaling requirement that would justify the operational overhead.
- *How would you add a new module?* Create `modules/<name>/<name>.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.validator.ts`, `.test.ts` — mount in `app.ts`. No other file needs changing.
- *Why node-cron in-process for deal health?* Approach B (separate worker process) was evaluated and rejected for time-budget reasons. In-process cron is a documented trade-off, not an oversight.

**Code Quality**
- *What does the service layer do?* Business logic only. No `req`/`res`, no raw SQL. Calls repository for data, enforces business rules, throws typed `AppError`.
- *What does the repository do?* SQL queries only. Parameterized. Maps DB rows to domain objects. No business logic.
- *Why `withTransaction`?* Multi-step writes (e.g. discount check → evaluations insert → status update → approval_request creation) must be atomic. A partial failure must roll back, not leave the DB half-updated.

---

*Last updated: Phase 0 complete — DealFlow360*
