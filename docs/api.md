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

> Endpoints will be documented here after Phase 0.

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

### Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{ email, password }` | Internal users (rep/manager/admin) — JWT |
| POST | `/api/v1/portal/auth/magic-link` | `{ email }` | Sends a portal magic-link |
| POST | `/api/v1/portal/auth/verify` | `{ token }` | Exchanges magic-link token for a portal session |

### Admin / Catalog (`/api/v1/admin/...`)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/admin/products` | Product CRUD |
| GET/POST | `/admin/price-lists` | Price list + items |
| GET/POST | `/admin/customers` | Customer CRUD, tier assignment |
| GET/POST | `/admin/discount-ceilings` | Per-tier and per-category ceilings (FR2) |
| GET/POST | `/admin/warehouses` | Warehouse CRUD, stock levels |
| GET/POST | `/admin/subscription-plans` | Billing plan config |
| GET/POST | `/admin/upsell-config` | Margin threshold + ranking weights |

### Quotations & Discount Engine

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations` | Create draft quotation |
| POST | `/api/v1/quotations/:id/lines` | Add/edit a line |
| POST | `/api/v1/quotations/:id/check-discounts` | Pure discount-engine call (FR2/FR3) — no side effects |
| POST | `/api/v1/quotations/:id/submit` | Submits for approval if ceilings breached, else auto-confirms |

### Approvals

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/approvals` | Approvals queue (manager) |
| GET | `/api/v1/approvals/:id` | Risk breakdown, per-line detail, step history |
| POST | `/api/v1/approvals/:id/decide` | `{ action: approve\|reject\|return }` — writes `audit_log` (FR4) |

### Fulfillment

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations/:id/fulfillment/split` | Computes warehouse split (FR6) |
| POST | `/api/v1/fulfillment/:splitId/override` | Manual override of a suggested split |

### Billing

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/quotations/:id/billing/confirm` | One-time → invoice, recurring → subscription (FR7) |
| GET | `/api/v1/subscriptions/:id` | Subscription + billing-line detail |
| POST | `/api/v1/subscriptions/:id/cancel` | Cancellation (manual credit note for v1, see cut list) |

### Customer Portal (`/api/v1/portal/...`)

Scoped strictly to the authenticated `customer_portal_users` row — every query filters by
`customer_id`, never trusts a client-supplied id (NFR2).

| Method | Path | Notes |
|---|---|---|
| GET | `/portal/quotations/:id` | Read-only view of own quotation |
| POST | `/portal/quotations/:id/messages` | Comment / counter-discount (FR8) |
| POST | `/portal/quotations/:id/confirm` | Re-runs FR2/FR3; re-enters approval if breached (FR9) |

### Upsell / Cross-Sell

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/quotations/:id/upsell` | Ranked suggestions filtered by margin threshold (FR5) |

### Deal Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/deal-health` | Dashboard: stalled / discount anomaly / slippage flags (FR10) |
| POST | `/api/v1/deal-health/:id/escalate` | Escalate or nudge action on a flagged deal |

### Reporting

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/reports` | Filterable by period/team/status/product (FR11) |
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

*Last updated: scaffold initialization — awaiting problem statement*
