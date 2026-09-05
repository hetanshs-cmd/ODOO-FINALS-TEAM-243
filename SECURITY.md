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
- **JWT tokens** use short-lived access tokens. The signing secret comes from environment variables only.
- **Input validation** is performed on every API endpoint that accepts input.
- **Error responses** never expose stack traces, database errors, or internal details.
- **CORS** is configured explicitly. Never uses `origin: '*'` in production.
- **HTTP headers** are secured via Helmet.js.

## Known Security Checklist

Before any commit:

```
[ ] No hardcoded passwords, secrets, or tokens
[ ] No .env files committed (checked via .gitignore)
[ ] All SQL queries parameterized
[ ] All user input validated before processing
[ ] Error responses contain no internal details
[ ] Authentication applied to all protected routes
[ ] Authorization checked at the service layer
```

## Dependency Vulnerabilities

Run `npm audit` in both `backend/` and `frontend/` directories regularly.

GitHub Actions security checks also run `npm audit --audit-level=high` on every push.
