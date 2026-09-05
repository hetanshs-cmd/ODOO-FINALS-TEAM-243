# Security

This document describes the security architecture and requirements for this project.

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

### JWT Strategy

If JWT is used (to be confirmed during Phase 0):

| Property | Value |
|----------|-------|
| Algorithm | HS256 (or RS256 if keys available) |
| Secret | Environment variable `JWT_SECRET` — never hardcoded |
| Access token lifetime | 15–60 minutes |
| Refresh token | Stored securely (httpOnly cookie or secure storage) |

```typescript
// NEVER DO THIS
const token = jwt.sign(payload, 'my-hardcoded-secret');

// ALWAYS DO THIS
const token = jwt.sign(payload, process.env.JWT_SECRET!, {
  expiresIn: '15m'
});
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

If roles are required (determined in Phase 0):
- Implement RBAC (Role-Based Access Control)
- Check permissions in Service layer
- Do not check permissions in Routes alone

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

*Last updated: scaffold initialization*
