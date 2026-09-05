# Architecture — DealFlow360

## Overview

This project uses a **layered monolith** architecture with strict separation of concerns.

A clean modular monolith is preferred for a hackathon over microservices — simpler to develop, deploy, and explain during presentation. Microservices will only be considered if the problem genuinely requires them.

---

## Architectural Approaches Considered

### Approach A — Layered monolith (chosen)

Route → Controller → Service → Repository → Postgres, single deployable.

- ✅ Fastest to build in 24h, fits scaffold as-is, easiest for a 4-person team to reason about.
- ❌ Deal-health background job and billing-cycle job run in-process — acceptable at hackathon scale, would need extraction at real scale.

### Approach B — Monolith + separate worker process for scheduled jobs

Same as A, but deal-health scans and subscription billing cycles run in a second Node process reading the same DB.

- ✅ Cleaner separation, demonstrates system-design maturity to judges.
- ❌ Extra process to run/demo, more moving parts to debug live — real risk given the time budget.

**Decision: Approach A.** The "scheduled job" is simulated with a `node-cron` task inside the same Express process. Approach B was considered and rejected purely for time-budget reasons at hackathon scale — see `technology-decisions.md`.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│                  React + Vite + TypeScript               │
│                                                         │
│  Pages → Components → Hooks → Services → Constants      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API (/api/v1/...)
                       │
┌──────────────────────▼──────────────────────────────────┐
│                      BACKEND                            │
│                 Node.js + Express + TypeScript           │
│                                                         │
│  Routes                                                 │
│    ↓                                                    │
│  Middleware (auth, validation, rate-limit, logging)      │
│    ↓                                                    │
│  Controllers (parse req → call service → format res)    │
│    ↓                                                    │
│  Services (business logic, orchestration)               │
│    ↓                                                    │
│  Repositories (SQL queries, DB mapping)                 │
│    ↓                                                    │
│  PostgreSQL                                             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    DATABASE                             │
│                     PostgreSQL                          │
│            (Docker Compose for local dev)               │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Layer Responsibilities

### Route Layer

- Declares HTTP method and URL path
- Attaches middleware (authentication, rate limiting)
- Delegates to Controller
- **Forbidden:** SQL, business logic

### Controller Layer

- Parses HTTP request (body, params, query)
- Calls Validator
- Calls Service
- Formats and returns HTTP response
- **Forbidden:** SQL, business rules, direct DB access

### Service Layer

- Contains all business logic
- Enforces business rules
- Orchestrates repository calls
- Manages transactions where appropriate
- **Forbidden:** HTTP `req`/`res` objects, raw SQL

### Repository Layer

- Executes parameterized SQL queries
- Maps database rows to domain objects
- **Forbidden:** Business logic, HTTP logic

### Validator Layer

- Validates request schema (Zod)
- Checks types, formats, lengths, enums, cross-field rules
- **Forbidden:** Database side effects, business logic

---

## Module Structure

Each domain feature lives in its own module:

```
backend/src/modules/<module-name>/
  ├── <module>.routes.ts
  ├── <module>.controller.ts
  ├── <module>.service.ts
  ├── <module>.repository.ts
  ├── <module>.validator.ts
  ├── <module>.model.ts
  └── <module>.test.ts
```

**Modules (per the DealFlow360 domain, built in this order — see `development-workflow.md` for the hour-by-hour plan):**

```
auth, admin (products/price-lists/customers/ceilings/warehouses/plans),
quotations, discount-engine, approvals, fulfillment, billing,
portal, upsell, deal-health, reporting
```

---

## Frontend Structure

```
frontend/src/
  ├── components/       # Reusable UI components
  ├── pages/            # Page-level components (one per route)
  ├── layouts/          # Layout wrappers
  ├── hooks/            # Custom React hooks
  ├── services/         # API call wrappers
  ├── context/          # React context providers
  ├── utils/            # Pure utility functions
  ├── validators/       # Client-side validation schemas
  ├── constants/        # App constants (API URLs, enums)
  ├── types/            # TypeScript types and interfaces
  └── App.tsx
```

---

## Error Handling Strategy

```
Request → Validator → Controller → Service → Repository
                                      ↓
                              AppError thrown
                                      ↓
                        Global Error Handler Middleware
                                      ↓
                         Structured JSON Error Response
```

**Typed error classes:**

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public message: string,
    public details?: unknown[]
  ) { super(message); }
}
```

---

## API Design

- Versioned: `/api/v1/`
- RESTful conventions
- Consistent success/error response envelope
- Full specification in [`docs/api.md`](api.md)

---

## Database Strategy

- PostgreSQL (production-grade)
- ER-first design (database before backend code)
- All schema changes via versioned migrations
- Parameterized queries only
- Full specification in [`docs/database.md`](database.md)

---

## Security Architecture

- bcrypt password hashing
- JWT authentication (short-lived access tokens)
- Parameterized SQL
- Secure HTTP headers (Helmet)
- CORS configured per environment
- Secrets via environment variables only
- Full specification in [`docs/security.md`](security.md)

---

## Deployment (Local Development)

```
Docker Compose
  └── postgres:15 container
        └── Port 5432

Backend  → http://localhost:4000
Frontend → http://localhost:5173
```

---

## Confirmed Assumptions

- [x] Single-database architecture is sufficient (PostgreSQL, relational domain)
- [x] Monolith backend is appropriate (Approach A above)
- [x] REST API is the right paradigm (not GraphQL/WebSocket)
- [x] React is the right frontend framework
- [x] Authentication is required — two fully separate schemes (internal JWT, portal magic-link)

---

*Last updated: Phase 0 complete — DealFlow360*
