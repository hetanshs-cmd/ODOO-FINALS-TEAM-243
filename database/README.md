# Database

> This directory contains database schema documentation.

## Contents

| File/Directory | Description |
|---------------|-------------|
| `schema/er-diagram.md` | Entity-Relationship diagram (updated during Phase 0) |

## Migrations

Database migrations live in the backend:

```
backend/migrations/
  001_create_users.sql
  002_create_<entity>.sql
  ...
```

## Seeds

Development seed data:

```
backend/seeds/
  01_users.sql
  02_<entity>.sql
  ...
```

Seeds are for development only. Never run in production.

---

*Last updated: scaffold initialization*
