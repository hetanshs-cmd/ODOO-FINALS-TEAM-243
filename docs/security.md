# Security — DealFlow360

This document describes the security architecture for DealFlow360.

---

## Principles

1. **Defense in depth** — Multiple layers of security, not a single point of trust.
2. **Least privilege** — Every component gets only the permissions it needs.
3. **Fail securely** — Errors reveal nothing about internals.
4. **Input validation** — All input validated before processing.
5. **Parameterized SQL** — No SQL injection possible.
6. **Secrets management** — No secrets in code, ever.

---

## Authentication

### Password Storage

Passwords are **never stored as plaintext**.

Use bcrypt with work factor ≥ 12:

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hashing
const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Verification
const isValid = await bcrypt.compare(plainPassword, storedHash);
```

### Auth Schemes (Confirmed — Two Fully Separate Schemes)

**Internal staff (rep/manager/admin/finance):**

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Secret | `JWT_SECRET` env variable — min 32 chars, enforced by Zod at startup |
| Token lifetime | 15 minutes (`JWT_ACCESS_EXPIRY`) |
| Scope claim | `scope: "internal"` — rejected on any portal endpoint |
| Usage | `Authorization: Bearer <token>` on all `/api/v1/*` internal routes |

**Customer portal:**

| Property | Value |
|----------|-------|
| Scheme | Magic-link (one-time 64-char hex token, 15 min TTL) |
| Token storage | In-memory `Map` (stub phase) — would move to DB for production |
| JWT scope | `scope: "portal"` — rejected on any internal endpoint |
| Customer binding | JWT carries `customerId`; every portal query enforces row-level match |

The `scope` claim is what prevents a customer token from being used on internal endpoints
(and vice versa) — `verifyInternalToken` throws if `scope !== "internal"`.

```typescript
// NEVER DO THIS
const token = jwt.sign(payload, 'my-hardcoded-secret');

// ALWAYS DO THIS
const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '15m' });
```

---

## SQL Security

### Parameterized Queries

**FORBIDDEN:**

```typescript
// SQL INJECTION VULNERABILITY — NEVER DO THIS
const result = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

**REQUIRED:**

```typescript
// SAFE — Parameterized query
const result = await db.query(
  'SELECT id, name, email FROM users WHERE email = $1',
  [email]
);
```

All database queries use parameterized syntax.

---

## HTTP Security Headers

Using Helmet.js:

```typescript
import helmet from 'helmet';
app.use(helmet());
```

This sets:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Strict-Transport-Security`

---

## CORS

CORS is configured explicitly, not open:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Never use `origin: '*'` in production.**

---

## Environment Variables

All secrets live in `.env` files (never committed):

```
DATABASE_URL=         # Database connection string
JWT_SECRET=           # JWT signing secret (min 32 chars, random)
BCRYPT_ROUNDS=12      # bcrypt work factor
PORT=4000             # Backend port
FRONTEND_URL=         # Frontend origin for CORS
NODE_ENV=             # development | test | production
```

**Rules:**
- `.env` is in `.gitignore`
- `.env.example` is in version control (with placeholder values only)
- Never log environment variable values
- Never return environment variable values in API responses

---

## Input Validation

All API input is validated before processing:

- Required fields
- Data types
- String lengths
- Format (email, phone, date, URL)
- Number ranges
- Enum membership
- Cross-field rules

Frontend validates for UX.
**Backend validation is authoritative.**

---

## Error Responses

Safe error responses:

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Resource not found"
}
```

**Never expose:**
- Stack traces
- Database error messages
- Internal file paths
- SQL queries
- Environment variable names
- Package versions

---

## Authorization

Authentication (who you are) is separate from Authorization (what you can do).

RBAC is implemented via the `roles` table (6 roles: `SALES_REP`, `SALES_MANAGER`,
`FINANCE`, `OPERATIONS`, `CUSTOMER`, `ADMIN`) and `role_permissions` junction table.

- Permission checks happen in the **Service layer** — not in routes alone
- Portal endpoints enforce customer-level row isolation: every query checks `customer_id`
  from the JWT, not from client-supplied parameters
- A customer cannot access another customer's quotation regardless of UI

---

## Rate Limiting

Apply rate limiting to:
- Authentication endpoints (prevent brute force)
- Sensitive operations
- Public endpoints if applicable

---

## Dependency Security

```bash
# Check for known vulnerabilities
npm audit

# CI will run this automatically
```

Do not ignore audit warnings without documented justification.

### Accepted exceptions

CI (`.github/workflows/security-checks.yml`) enforces `npm audit --audit-level=high`
via `scripts/ci-npm-audit-check.cjs`, which fails the build on any high/critical
vulnerability **except** packages explicitly allowlisted below. Adding to this
allowlist requires updating both this table and the `node scripts/ci-npm-audit-check.cjs
audit.json <package>` invocation in the workflow.

| Package | Where used | Severity | Why accepted |
|---------|-----------|----------|---------------|
| `xlsx` (frontend) | `frontend/src/services/reportingExport.ts` (report-to-Excel export) | High — [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (prototype pollution), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (ReDoS) | No patched version is published to the npm registry (SheetJS only ships the fix via their own CDN). Both advisories require attacker-controlled spreadsheet *input*; this app only ever writes exports, never parses untrusted uploads through this library. Revisit if that changes, or if a patched npm release appears. |

---

## Security Checklist (Pre-commit)

```
[ ] No hardcoded secrets
[ ] No plaintext passwords
[ ] All SQL queries parameterized
[ ] All input validated
[ ] Error responses reveal nothing internal
[ ] Authentication applied to protected routes
[ ] Authorization checked in service layer
[ ] Secrets in .env only (not committed)
[ ] CORS configured explicitly
[ ] Helmet applied
[ ] Rate limiting on sensitive routes
```

---

## Reporting Security Issues

If a security vulnerability is found:

1. Do NOT commit or push the vulnerable code
2. Notify the team immediately
3. Fix on a private branch
4. Review the fix together before merging

See also: [`SECURITY.md`](../SECURITY.md)

---

*Last updated: Phase 0 complete — DealFlow360*
