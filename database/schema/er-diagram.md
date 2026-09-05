# ER Diagram

> ⚠️ Entity-Relationship diagram will be created during Phase 0 analysis.
> No entities are defined until the problem statement is received.

---

## Database-First Approach

This project follows the principle: **design the database before writing backend code**.

The ER diagram will be created here during Phase 0 and kept updated as the schema evolves.

---

## ER Diagram

> To be created after Phase 0 analysis.

```
[ER Diagram will be inserted here]

Use text-based notation or embed an image of the ER diagram.
```

Example format (text-based):

```
USERS
─────
id          PK  UUID / SERIAL
email       UNIQUE NOT NULL
password    NOT NULL (bcrypt hash)
name        NOT NULL
role        NOT NULL DEFAULT 'user'
created_at  NOT NULL DEFAULT NOW()
updated_at  NOT NULL DEFAULT NOW()

ENTITY_B
────────
id          PK
user_id     FK → USERS.id ON DELETE CASCADE
...
```

---

## Relationships

> To be defined during Phase 0.

---

## Migration Files

All schema changes live in:

```
backend/migrations/
  001_create_users.sql
  002_create_<entity>.sql
  ...
```

---

*Last updated: scaffold initialization — awaiting problem statement*
