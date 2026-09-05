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
> [`database/schema/er-diagram.md`](../database/schema/er-diagram.md) (roles/users,
> customer_users, quotations/quotation_items, discount_rules/discount_evaluations,
> approval_requests/approval_actions, negotiations, sales_orders, fulfillments/backorders,
> invoices/payments, subscriptions/billing_schedules, deal_health_scores/deal_alerts).

### Auth & Config

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{ email, password }` | Internal users — JWT + role claim (`role_id` → `roles.name`) |
| POST | `/api/v1/portal/request-link` | `{ email }` | Sends a magic-link to a `customer_users`-linked email |
| POST | `/api/v1/portal/verify-link` | `{ token }` | Exchanges magic-link token for a portal session scoped to one `customer_id` |
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
| POST | `/api/v1/quotations/:id/items` | Add/edit a `quotation_items` row |
| POST | `/api/v1/quotations/:id/check-discounts` | Evaluates every item against `discount_rules` (strictest applicable), writes a `discount_evaluations` row per item (append-only, FR2/FR3) — may create an `approval_requests` row and move status to `PENDING_APPROVAL` |

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

### Sales Orders & Fulfillment

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations/:id/convert` | Converts an `APPROVED`/`ACCEPTED` quotation into a `sales_orders` row (1:1, unique `quotation_id`) |
| POST | `/api/v1/sales-orders/:id/suggest-fulfillment` | Computes warehouse split into `fulfillments`/`fulfillment_items` — minimize shipment count, shortfall → `backorders` (FR6) |
| POST | `/api/v1/fulfillments/:id/accept` | Marks a `fulfillments` row `ACCEPTED` |
| POST | `/api/v1/fulfillments/:id/override` | Manual per-warehouse quantity override |

### Billing

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/sales-orders/:id/billing/confirm` | Splits items by `billing_type` — `ONE_TIME` → `invoices`/`invoice_items`, `RECURRING` → `subscriptions`/`subscription_items` (FR7) |
| PATCH | `/api/v1/subscriptions/:id` | Modify qty/plan — prorates `days_remaining / total_days * price_delta` into a new `billing_schedules` row |
| POST | `/api/v1/subscriptions/:id/cancel` | Sets `subscriptions.status = CANCELLED`; mid-cycle prepaid balance handled via a `payments` refund (`status = REFUNDED`) |
| POST | `/api/v1/invoices/:id/payments` | Records a `payments` row against an invoice |

### Customer Portal (`/api/v1/portal/...`)

Scoped strictly to the authenticated `customer_users` row — every query filters by
`customer_id`, never trusts a client-supplied id (NFR2).

| Method | Path | Notes |
|---|---|---|
| GET | `/portal/quotations/:id` | Read-only view of own quotation (`customer_id` match enforced server-side) |
| POST | `/portal/quotations/:id/negotiations/messages` | Comment / counter-offer (FR8) |
| POST | `/portal/quotations/:id/confirm` | Applies accepted discount, re-runs FR2/FR3; re-enters approval if still over threshold, else moves to `ACCEPTED` and triggers order conversion (FR9) |

### Deal Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/deal-health` | Dashboard over `deal_alerts` (`STALLED`/`DISCOUNT_ANOMALY`/`DELIVERY_SLIPPAGE`) and latest `deal_health_scores` per quotation (FR10) |
| POST | `/api/v1/deal-health/:id/escalate` | Sets a `deal_alerts` row to `ESCALATED` |
| POST | `/api/v1/deal-health/:id/nudge` | Sets a `deal_alerts` row to `NUDGED`, fires a `notifications` row |

### Reporting

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/reports` | Aggregates directly over `quotations`/`quotation_items`/`invoices` — filterable by period/team/status/product (FR11) |
| GET | `/api/v1/reports/export` | PDF/XLS export (cut-list candidate — see `development-workflow.md`) |

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
