# API Reference

> ⚠️ API endpoints will be defined during Phase 0 analysis.
> No endpoints are implemented until the problem statement is analyzed.

---

## API Conventions

### Base URL

```
/api/v1/
```

All endpoints are versioned. This allows future `/api/v2/` without breaking existing clients.

---

### Authentication

Protected routes require an `Authorization` header:

```
Authorization: Bearer <access_token>
```

Unauthenticated requests to protected routes return `401 Unauthorized`.

---

### Response Envelope

**Success:**

```json
{
  "success": true,
  "data": { },
  "message": "Human readable message"
}
```

**Success (list):**

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20
  },
  "message": "Resources retrieved successfully"
}
```

**Error:**

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable explanation",
  "details": []
}
```

---

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Successful GET / PUT / PATCH |
| `201` | Successful POST (resource created) |
| `204` | Successful DELETE (no body) |
| `400` | Bad request (malformed syntax) |
| `401` | Unauthenticated (no/invalid token) |
| `403` | Unauthorized (authenticated but no permission) |
| `404` | Resource not found |
| `409` | Conflict (duplicate record) |
| `422` | Business rule violation |
| `500` | Unexpected server error |

---

### Error Codes

Error codes are machine-readable strings. Examples:

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request body failed schema validation |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource does not exist |
| `DUPLICATE_ENTRY` | Unique constraint violated |
| `BUSINESS_RULE_VIOLATION` | Application-level rule violated |
| `INTERNAL_SERVER_ERROR` | Unexpected server error |

Additional error codes will be documented per endpoint.

---

### Pagination

List endpoints support:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 100) |

---

### Validation

All endpoints accepting a request body validate:

- Required fields
- Data types
- String length limits
- Format (email, URL, date, etc.)
- Number ranges
- Enum membership
- Cross-field rules

Validation errors return `400` with `details` array listing each field error:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

---

## Endpoints

### Health Check

```
GET /api/v1/health
```

**Authentication:** None

**Response 200:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  },
  "message": "Service is healthy"
}
```

---

> Table/field names below match the definitive schema in
> [`database/schema/er-diagram.md`](../database/schema/er-diagram.md) (roles/users
> (portal link via `users.customer_id`), quotations/quotation_items, discount_rules/discount_evaluations,
> approval_requests/approval_actions, negotiations, sales_orders, fulfillments/backorders,
> invoices/payments, subscriptions/billing_schedules, deal_health_scores/deal_alerts).

### Auth & Config

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{ email, password }` | Internal users — JWT + role claim (`role_id` → `roles.name`) |
| POST | `/api/v1/auth/signup` | `{ name, email, password, role? }` | Creates a `users` row (bcrypt-hashed password) and logs in immediately — same response shape as login |
| POST | `/api/v1/portal/request-link` | `{ email }` | Sends a magic-link to a `users` row with `customer_id` set |
| POST | `/api/v1/portal/verify-link` | `{ token }` | Exchanges magic-link token for a portal session scoped to one `customer_id` |

#### POST /api/v1/auth/login

Internal (staff) login. Returns a short-lived JWT carrying the user's role.

**Authentication:** None

**Request body:**

```json
{ "email": "rep@example.com", "password": "correct-horse-battery-staple" }
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "...", "name": "...", "email": "...", "role": "SALES_REP" }
  },
  "message": "Login successful"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `email` or missing `password` |
| 401 | `INVALID_CREDENTIALS` | Unknown email, wrong password, or an inactive user — deliberately identical in all three cases, so the response never reveals whether an email is registered |

Use the token as `Authorization: Bearer <accessToken>` on protected internal routes.

#### POST /api/v1/auth/signup

Creates a new internal (staff) `users` row and immediately returns a session for it —
identical `{ accessToken, user }` shape to login, so a client can treat signup and login
responses the same way. `role` is optional and defaults to `SALES_REP` (the least-privileged
internal role) when omitted; when given, it must be `SALES_REP`. Privileged and customer
roles cannot be requested through public signup. The password is
hashed with bcrypt (`BCRYPT_ROUNDS`), same as login verifies against.

**Authentication:** None

**Request body:**

```json
{ "name": "Jane Rep", "email": "jane@example.com", "password": "correct-horse-battery-staple", "role": "SALES_REP" }
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "...", "name": "Jane Rep", "email": "jane@example.com", "role": "SALES_REP" }
  },
  "message": "Account created successfully"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `name`, `email`, `password` (min 8 chars), or any role other than `SALES_REP` |
| 400 | `INVALID_ROLE` | `role` is a syntactically valid enum value that somehow doesn't exist as a `roles` row |
| 409 | `CONFLICT` | A user with this email already exists |

#### POST /api/v1/portal/request-link

Requests a magic login link for a customer portal user (resolved through `users.customer_id`).
**Stub for this phase** — no email is sent yet; outside `NODE_ENV=production` the response
includes `devToken` so the flow can be exercised without a real inbox.

**Authentication:** None

**Request body:**

```json
{ "email": "buyer@customer.com" }
```

**Response 200** (identical whether or not the email is a valid, linked portal user — this
endpoint never reveals which emails exist):

```json
{
  "success": true,
  "data": {
    "message": "If this email is registered for portal access, a login link has been sent.",
    "devToken": "<only present outside production>"
  },
  "message": "If this email is registered for portal access, a login link has been sent."
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `email` |

#### POST /api/v1/portal/verify-link

Exchanges a magic-link token for a portal session JWT scoped to one `customer_id`. The token
is single-use and expires 15 minutes after being issued.

**Authentication:** None

**Request body:**

```json
{ "token": "<token from the request-link step>" }
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "...", "name": "...", "email": "..." },
    "customerId": "..."
  },
  "message": "Login successful"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid `token` |
| 401 | `INVALID_TOKEN` | Token doesn't exist, was already used, or its user is no longer active |
| 401 | `TOKEN_EXPIRED` | Token existed but its 15-minute window has passed |

Use the token as `Authorization: Bearer <accessToken>` on protected `/portal/*` routes.

| GET/POST/PATCH | `/api/v1/admin/products` | | `products` CRUD |
| GET/POST/PATCH | `/api/v1/admin/product-categories` | | `product_categories` CRUD (supports nesting via `parent_category_id`) |
| GET/POST/PATCH | `/api/v1/admin/price-lists` | | `price_lists` + `price_list_items` |
| GET/POST/PATCH | `/api/v1/admin/customers` | | `customers` CRUD, `customer_tier_id` assignment |
| GET/POST/PATCH | `/api/v1/admin/customer-tiers` | | `customer_tiers` CRUD |
| GET/POST/PATCH | `/api/v1/admin/discount-rules` | | Per product/category/tier discount rules (FR2) |
| GET/POST/PATCH | `/api/v1/admin/approval-levels` | | Approval chain levels |
| GET/POST/PATCH | `/api/v1/admin/warehouses` | | `warehouses` CRUD, `inventory` levels |
| GET/POST/PATCH | `/api/v1/admin/subscription-plans` | | `subscription_plans` config |
| GET/POST/PATCH | `/api/v1/admin/recommendation-rules` | | Upsell/cross-sell rule config |

All admin writes go through `audit_logs`.

### Quotations & Discount Engine

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations` | Create a `DRAFT` quotation |
| POST | `/api/v1/quotations/:id/items` | Add/edit a `quotation_items` row — response includes a computed `margin_percent` per item (null-safe on `products.cost_price`) |
| POST | `/api/v1/quotations/:id/submit` | **New.** `DRAFT` → `SUBMITTED`, then automatically runs the same evaluation as `check-discounts` (see below) — the frontend no longer needs to call `check-discounts` separately after submitting |
| POST | `/api/v1/quotations/:id/check-discounts` | Evaluates every item against `discount_rules` (strictest applicable), writes a `discount_evaluations` row per item (append-only, FR2/FR3) — may create an `approval_requests` row and move status to `PENDING_APPROVAL`. Also runs automatically as part of `submit` above |
| GET | `/api/v1/quotations/:id/timeline` | **New.** `audit_logs` rows for this quotation (`entity_type = 'quotation'`), ordered oldest-first — same auth as other quotation reads |

**Authentication:** `Authorization: Bearer <accessToken>`, role one of `SALES_REP`, `SALES_MANAGER`, `ADMIN`. A `SALES_REP` only sees/acts on their own quotations.

#### POST /api/v1/quotations/:id/submit

**Request body:** none

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "PENDING_APPROVAL",
    "items": [ { "...": "...", "margin_percent": 34.5 } ]
  },
  "message": "Quotation submitted successfully"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | Quotation doesn't exist |
| 403 | `FORBIDDEN` | Caller is a `SALES_REP` who doesn't own this quotation |
| 422 | `BUSINESS_RULE_VIOLATION` | Quotation isn't `DRAFT`, or has no items |

#### GET /api/v1/quotations/:id/timeline

**Response 200:**

```json
{
  "success": true,
  "data": [
    { "id": "...", "action": "QUOTATION_CREATED", "user_id": "...", "old_value": null, "new_value": { "...": "..." }, "created_at": "..." },
    { "id": "...", "action": "QUOTATION_SUBMITTED", "...": "..." },
    { "id": "...", "action": "DISCOUNT_CHECK", "...": "..." }
  ],
  "message": "Quotation timeline retrieved successfully"
}
```

### Approvals

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/approvals?status=PENDING` | Approver's queue over `approval_requests` |
| GET | `/api/v1/approvals/:id` | Risk breakdown, item detail, `approval_actions` history |
| POST | `/api/v1/approvals/:id/act` | `{ action: APPROVE\|REJECT\|ESCALATE\|RETURN, comment }` — inserts an `approval_actions` row and `audit_logs` entry (FR4); final `APPROVE` triggers fulfillment suggestion |

### Negotiation

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations/:id/negotiations` | Opens a `negotiations` thread |
| POST | `/api/v1/negotiations/:id/messages` | Adds a `negotiation_messages` row (`COMMENT`/`COUNTER_OFFER`/`ACCEPTANCE`/`REJECTION`) |
| POST | `/api/v1/negotiations/:id/changes` | Records a `negotiation_changes` row (field-level diff) and re-runs `check-discounts`; breaching the ceiling again re-creates an `approval_requests` row (FR9) |

### Upsell / Cross-Sell

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/quotations/:id/recommendations` | Ranked list from `recommendation_rules`, filtered by margin threshold (FR5) |

### Customers & Users Directory

**New.** Read-only lookups used by the sales org for customer/name display — distinct from
the ADMIN-only `/admin/customers` CRUD, which is unchanged.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/customers` | `SALES_REP`, `SALES_MANAGER`, `ADMIN` | Paginated `id`/`company_name`/`customer_tier_id`/`status` list |
| GET | `/api/v1/users` | Any authenticated internal role | Full (unpaginated) `id`/`name`/`role` directory of `ACTIVE` users — no email or other sensitive fields |

### Sales Orders & Fulfillment

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations/:id/convert` | Converts an `APPROVED`/`ACCEPTED` quotation into a `sales_orders` row (1:1, unique `quotation_id`) |
| POST | `/api/v1/sales-orders/:id/suggest-fulfillment` | Computes warehouse split into `fulfillments`/`fulfillment_items` — minimize shipment count, shortfall → `backorders` (FR6) |
| POST | `/api/v1/fulfillments/:id/accept-split` | **New.** Confirms the system-suggested warehouse allocation as final: `PENDING` → `IN_PROGRESS` |
| POST | `/api/v1/fulfillments/:id/override-split` | **New.** `{ items: [{ sales_order_item_id, quantity }] }` — manually adjusts already-allocated line quantities on a still-`PENDING` fulfillment; each change is validated against that warehouse's current available inventory and the reservation is adjusted by the delta |
| GET | `/api/v1/backorders` | **New.** Paginated list, scoped `OPERATIONS`, `SALES_MANAGER`, `ADMIN` |
| POST | `/api/v1/backorders/:id/consolidate` | **New.** Once a warehouse has enough available inventory to fully cover an `OPEN`/`PARTIALLY_FULFILLED` backorder, creates a `fulfillments`/`fulfillment_items` row for it, reserves the inventory, reduces the sales order item's `backordered_quantity`, and marks the backorder `FULFILLED`. 422s if no single warehouse can cover the full remaining quantity |

#### POST /api/v1/fulfillments/:id/override-split

**Request body:**

```json
{ "items": [ { "sales_order_item_id": "...", "quantity": 5 } ] }
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | Fulfillment doesn't exist |
| 422 | `BUSINESS_RULE_VIOLATION` | Fulfillment isn't `PENDING`, an item isn't part of this fulfillment, or the increase exceeds available inventory at this warehouse |

### Billing

Audit safety changes (2026-09-05): initial billing locks the sales order and rejects
cancelled orders (422), previously billed orders (409), and any order with unshipped
`ONE_TIME` product quantities (422). The current schema does not distinguish physical
goods from one-time services, so this guard conservatively blocks both until shipped.
Partial invoicing is not implemented: 6 shipped out of 10 produces no invoice yet.
Invoice subtotal excludes tax; total includes tax exactly once.

Payments require finite positive amounts with at most two decimal places. Validation
rejects malformed amounts (400); the service checks the locked invoice status and
remaining balance before inserting payment/audit records (422 for paid/void invoices
or overpayment). Repeated full-payment requests cannot overpay the locked balance.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/sales-orders/:id/billing/confirm` | Splits items by `billing_type` — `ONE_TIME` → `invoices`/`invoice_items`, `RECURRING` → `subscriptions`/`subscription_items` (FR7) |
| GET | `/api/v1/subscriptions` | **New.** Paginated list, filterable by `status`/`customer_id` |
| GET | `/api/v1/subscriptions/:id` | **New.** Single subscription |
| PATCH | `/api/v1/subscriptions/:id` | Modify plan/quantity — prorates `days_remaining / total_days * price_delta` into a new `billing_schedules` row on an upgrade; a downgrade now creates a `credit_notes` row for the prorated refund instead of silently skipping |
| POST | `/api/v1/subscriptions/:id/cancel` | Sets `subscriptions.status = CANCELLED`, `end_date = today`, clears `next_billing_date`; also creates a `credit_notes` row for the unused portion of the current cycle, if any |
| POST | `/api/v1/invoices/:id/payments` | Records a `payments` row against an invoice |
| GET | `/api/v1/credit-notes` | **New.** Paginated list, filterable by `status`/`customer_id`/`subscription_id` |
| GET | `/api/v1/credit-notes/:id` | **New.** Single credit note |
| PATCH | `/api/v1/credit-notes/:id/status` | **New.** `{ status: APPLIED\|VOIDED }` — one-way transition from `PENDING` only |

**Authentication (subscriptions & invoices):** `Authorization: Bearer <accessToken>`, role one of
`FINANCE`, `SALES_MANAGER`, `ADMIN` — same internal-role gate as the rest of billing.

#### PATCH /api/v1/subscriptions/:id

Changes a subscription's plan and/or quantity. `current_price` is modeled as
`plan.price × quantity` (`quantity` defaults to `1` when omitted). If the new price is higher
than the current one, the difference is prorated over the days remaining until
`next_billing_date` (Ghost's proration model — see `docs/references.md`) and billed
immediately as a one-off `billing_schedules` row; a downgrade takes effect for future cycles
only (no refund is issued). On success the subscription's `status` moves to `MODIFIED`.

**Request body:**

```json
{ "plan_id": "b6e6b6d0-....", "quantity": 2 }
```

At least one of `plan_id` / `quantity` is required.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "customer_id": "...",
    "plan_id": "b6e6b6d0-....",
    "status": "MODIFIED",
    "current_price": "200.00",
    "next_billing_date": "2026-10-01",
    "...": "..."
  },
  "message": "Subscription updated successfully"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Neither `plan_id` nor `quantity` given, `plan_id` isn't a UUID, or `quantity` isn't positive |
| 404 | `NOT_FOUND` | Subscription or `plan_id` doesn't exist |
| 422 | `BUSINESS_RULE_VIOLATION` | Subscription is already `CANCELLED`, or the target plan is `INACTIVE` |

#### POST /api/v1/subscriptions/:id/cancel

Cancels an active subscription: sets `status = CANCELLED`, `end_date` to today, and clears
`next_billing_date` so no further `billing_schedules` rows are generated for it.

**Request body:** none

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CANCELLED",
    "end_date": "2026-09-05",
    "next_billing_date": null,
    "...": "..."
  },
  "message": "Subscription cancelled successfully"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | Subscription doesn't exist |
| 422 | `BUSINESS_RULE_VIOLATION` | Subscription is already `CANCELLED` |

### Customer Portal (`/api/v1/portal/...`)

Scoped strictly to the authenticated user's `users.customer_id` — every query filters by
`customer_id`, never trusts a client-supplied id (NFR2).

| Method | Path | Notes |
|---|---|---|
| GET | `/portal/quotations` | **New.** All of the caller's own quotations, filtered by the portal JWT's `customer_id` |
| GET | `/portal/quotations/:id` | Read-only view of own quotation (`customer_id` match enforced server-side) |
| GET | `/portal/invoices` | **New.** All of the caller's own invoices, filtered by `customer_id` |
| GET | `/portal/invoices/:id` | **New.** Read-only view of own invoice (`customer_id` match enforced server-side) |
| POST | `/portal/quotations/:id/negotiations/messages` | Comment / counter-offer (FR8) |
| POST | `/portal/quotations/:id/confirm` | Applies accepted discount, re-runs FR2/FR3; re-enters approval if still over threshold, else moves to `ACCEPTED` and triggers order conversion (FR9) |

### Deal Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/deal-health` | Dashboard over `deal_alerts` (`STALLED`/`DISCOUNT_ANOMALY`/`DELIVERY_SLIPPAGE`) and latest `deal_health_scores` per quotation (FR10) |
| POST | `/api/v1/deal-health/:alertId` | `{ status: ESCALATED\|NUDGED\|RESOLVED }` — updates one `deal_alerts` row's status |

### Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/notifications` | The authenticated user's `notifications`, paginated |
| PATCH | `/api/v1/notifications/:id/read` | Marks one `notifications` row read |

### Reporting

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/reports` | Aggregates directly over `quotations`/`quotation_items`/`invoices` — filterable by period/team/status/product (FR11) |
| GET | `/api/v1/reports/export` | PDF/XLS export (cut-list candidate — see `development-workflow.md`) |

### AI (`/api/v1/ai/...`)

Local-model-backed replacement for the frontend's deterministic `contextualAIAdapter`
templates (`docs/technology-decisions.md` documents the Ollama/`qwen2.5:3b-instruct`
choice). Grounding data is gathered through each domain module's existing
role-scoped service function (`quotationsService`, `approvalsService`,
`dealHealthService`, `negotiationsService`, `reportingService`) — this module never
queries a repository directly, so it inherits existing authorization/tenant-scoping
rather than re-implementing it. On any failure to reach or parse a response from the
local model, both routes reject with `AI_UNAVAILABLE` (503); the frontend then falls
back to its deterministic adapter rather than showing a broken state.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/ai/insight` | `{ type, entityId?, instructions? }` — one-shot structured insight for one of the 8 use-cases in `ai.validator.ts`'s `insightTypeSchema` (quotation summary/risk/improvements/draft, approval explain/draft-note, deal-health summary/nudge, negotiation reply draft, report summary). Returns `{ summary, bullets?, rationale?, confidence? }`. |
| POST | `/api/v1/ai/chat` | `{ messages: {role,content}[] }` — multi-turn workspace chat, grounded on every call in the requester's own pending approvals and open deal-health alerts. Purely navigational questions ("where is X") are answered client-side and never reach this route. |

---

## API Design Rules

1. Use nouns for resource paths, not verbs
   - ✅ `GET /api/v1/users`
   - ❌ `GET /api/v1/getUsers`

2. Use HTTP methods correctly
   - `GET` — read only, no side effects
   - `POST` — create resource
   - `PUT` — replace resource
   - `PATCH` — partial update
   - `DELETE` — remove resource

3. Use plural resource names
   - ✅ `/api/v1/users`
   - ❌ `/api/v1/user`

4. Nested resources for relationships
   - ✅ `GET /api/v1/users/:userId/orders`

5. Filtering via query params
   - ✅ `GET /api/v1/users?role=admin&active=true`

---

*Last updated: Phase 0 complete — DealFlow360 (definitive 41-table schema)*
