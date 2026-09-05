# Security Policy

## Supported Versions

This is a hackathon project. Only the latest version is maintained.

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue.
2. **Do NOT** commit or push the vulnerable code.
3. Notify the team privately immediately.
4. Fix on a private branch.
5. Review the fix together before merging.

## Security Principles

This project follows these security principles:

- **Passwords** are hashed with bcrypt (work factor ≥ 12). Never stored as plaintext.
- **SQL queries** are always parameterized. String interpolation into SQL is forbidden.
- **Secrets** (JWT secret, DB credentials, API keys) live only in environment variables. Never hardcoded.
- **JWT tokens:** Two separate schemes — `scope: "internal"` for staff, `scope: "portal"` for customers. Cross-scope use is rejected at verification.
- **Portal isolation:** Every portal query enforces `customer_id` from the JWT — never from client input. Customers cannot access other customers' data.
- **Magic-link tokens** are one-time-use (deleted on first verify) with a 15-minute TTL.
- **Input validation** is performed on every API endpoint that accepts input (Zod schemas).
- **Error responses** never expose stack traces, database errors, or internal details.
- **CORS** is configured explicitly to `FRONTEND_URL` only. Never uses `origin: '*'` in production.
- **HTTP headers** are secured via Helmet.js (14 headers including CSP, X-Frame-Options, HSTS).
- **Rate limiting** is applied globally: 100 requests per 15 minutes per IP.

## Known Security Checklist

Before any commit:

```
[ ] No hardcoded passwords, secrets, or tokens
[ ] No .env files committed (checked via .gitignore)
[ ] All SQL queries parameterized ($1, $2 — never string concatenation)
[ ] All user input validated before processing (Zod schema)
[ ] Error responses contain no internal details, stack traces, or SQL
[ ] Authentication applied to all protected routes
[ ] Authorization checked at the service layer (not route only)
[ ] Portal endpoints enforce customer_id row-level check on every query
[ ] JWT_SECRET is at least 32 characters (enforced by Zod at startup)
```

## Dependency Vulnerabilities

Run `npm audit` in both `backend/` and `frontend/` directories regularly.

GitHub Actions security checks also run `npm audit --audit-level=high` on every push.
