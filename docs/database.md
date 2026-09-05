# Database Design

> ⚠️ Database entities and schema will be designed during Phase 0 analysis.
> No tables will be created until the problem statement is analyzed.

---

## Database-First Principle

This project follows an **ER-first** approach:

```
Problem Statement
  ↓
Phase 0 Analysis
  ↓
Identify Entities
  ↓
Create ER Diagram
  ↓
Define Tables + Constraints + Indexes
  ↓
Write Migrations
  ↓
Write Repositories
  ↓
Write Services
  ↓
Write Controllers
  ↓
Write Routes
  ↓
Write Frontend
```

**Backend code is never written before the database schema is approved.**

---

## Database Technology

**PostgreSQL** (version 15+)

Reasons:
- ACID-compliant
- Mature, production-grade
- Strong support for constraints
- Excellent performance for relational data
- Native JSON support if needed
- Well-supported by `pg` (node-postgres)

---

## Migration Strategy

All schema changes use numbered SQL migrations:

```
backend/migrations/
  001_create_users.sql
  002_create_<entity>.sql
  003_add_<index>.sql
  ...
```

**Rules:**
- Never manually modify schema in production
- Never modify an already-applied migration
- New changes always in new migration files
- Migrations run in numeric order

**Migration runner:**

```bash
cd backend && npm run migrate
```

---

## Normalization Target

**Third Normal Form (3NF)** unless there is a documented, justified reason to denormalize.

Reasons to denormalize must be:
- Performance-measured
- Documented here
- Reviewed by the team

---

## Schema Checklist (for every table)

```
[ ] Primary key defined
[ ] Foreign keys explicit and correct
[ ] Required columns have NOT NULL
[ ] Natural identifiers have UNIQUE constraint
[ ] CHECK constraints for valid value ranges
[ ] Appropriate ON DELETE behavior (CASCADE, RESTRICT, SET NULL)
[ ] Indexes on FK columns
[ ] Indexes on frequent WHERE columns
[ ] Indexes on JOIN and ORDER BY columns
[ ] No SELECT * in queries (select needed columns only)
[ ] No business logic encoded incorrectly in the schema
```

---

## ER Diagram

> To be created during Phase 0.

```
[ER Diagram will be inserted here after Phase 0 analysis]
```

---

## Tables

> To be defined during Phase 0.

---

## Relationships

> To be defined during Phase 0.

---

## Indexes

> To be defined during Phase 0 based on actual query patterns.

---

## Query Considerations

> To be identified during Phase 0.

Known patterns to watch:
- N+1 query problems
- Pagination patterns
- Search / filter patterns
- Aggregation patterns

---

## Seeding

Development seed data lives in:

```
backend/seeds/
```

Seeds are for development only. Never used in production.

```bash
cd backend && npm run seed
```

---

*Last updated: scaffold initialization — awaiting problem statement*
