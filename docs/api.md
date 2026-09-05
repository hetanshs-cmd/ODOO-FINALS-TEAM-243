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

### [Future Endpoints]

> Will be added after Phase 0 analysis identifies required API surface.

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
