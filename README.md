# Odoo Hiring Hackathon — Team 243

> **Status:** Scaffold initialized. Awaiting official problem statement.

---

## Problem

> ⚠️ Official problem statement has not yet been received.
> This file will be updated once the problem is announced.
> See [`docs/problem-statement.md`](docs/problem-statement.md).

---

## Target Users

> To be determined after problem statement is received.

---

## Features

> To be determined after problem statement analysis (Phase 0).

---

## Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Backend Runtime | Node.js + Express | Default — will be re-evaluated after problem statement |
| Database | PostgreSQL | Relational, ACID-compliant, production-grade |
| Frontend | React + Vite | Default — will be re-evaluated after problem statement |
| Language | TypeScript | Type safety, better maintainability |
| Validation | Zod | Schema-first, TypeScript-native |
| DB Client | pg (node-postgres) | Direct, parameterized queries, no ORM magic |
| Testing | Vitest + Supertest | Fast unit + integration testing |
| Formatting | Prettier | Consistent formatting across team |
| Linting | ESLint | Code quality enforcement |
| Containers | Docker Compose | Reproducible local PostgreSQL |

> **Important:** Stack will be re-evaluated against the actual problem statement before implementation begins.

---

## Architecture

```
Frontend (React + Vite)
         ↓  HTTP (REST API)
Backend (Node.js + Express)
  ├── Routes
  ├── Controllers
  ├── Services (business logic)
  ├── Repositories (database access)
  └── Validators
         ↓
PostgreSQL (via Docker Compose locally)
```

Full architecture documentation: [`docs/architecture.md`](docs/architecture.md)

---

## Database

ER-first design. No schema changes outside of versioned migrations.

```
backend/migrations/
  001_create_users.sql
  002_create_<entity>.sql
  ...
```

Full database documentation: [`docs/database.md`](docs/database.md)

---

## Authentication & Security

- Passwords hashed with bcrypt (work factor ≥ 12)
- JWT with short-lived access tokens (env-variable secret)
- Parameterized SQL only — no string interpolation
- Secure HTTP headers, CORS configured explicitly
- Secrets in environment variables only

Full security documentation: [`docs/security.md`](docs/security.md)

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Docker + Docker Compose
- Git

### 1. Clone

```bash
git clone <repository-url>
cd odoo-hackathon
```

### 2. Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Edit both `.env` files with your local values.

### 3. Start Database

```bash
docker-compose up -d
```

### 4. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 5. Run Migrations

```bash
cd backend && npm run migrate
```

### 6. Seed (optional)

```bash
cd backend && npm run seed
```

### 7. Run Backend

```bash
cd backend && npm run dev
```

### 8. Run Frontend

```bash
cd frontend && npm run dev
```

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

**Never commit real `.env` files.**

---

## Running Tests

```bash
# Backend unit + integration tests
cd backend && npm test

# Coverage report
cd backend && npm run test:coverage

# Frontend tests
cd frontend && npm test
```

---

## Git Workflow

```
main          ← stable / demo-ready
  ↑
  dev         ← integration
    ↑
    feature/* ← all development
    fix/*
    docs/*
    test/*
```

Full workflow: [`docs/development-workflow.md`](docs/development-workflow.md)
Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## Team

| Member | Role |
|--------|------|
| Member 1 | Architecture / Integration / Review |
| Member 2 | Backend / API |
| Member 3 | Frontend / UI/UX |
| Member 4 | Testing / Documentation / Integration |

> Responsibilities will be reassigned to specific modules after Phase 0 analysis.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/problem-statement.md`](docs/problem-statement.md) | Official problem statement |
| [`docs/requirements.md`](docs/requirements.md) | Functional + non-functional requirements |
| [`docs/architecture.md`](docs/architecture.md) | System architecture |
| [`docs/database.md`](docs/database.md) | Database design + ER diagrams |
| [`docs/api.md`](docs/api.md) | API reference |
| [`docs/security.md`](docs/security.md) | Security design |
| [`docs/testing.md`](docs/testing.md) | Testing strategy |
| [`docs/development-workflow.md`](docs/development-workflow.md) | Git and dev workflow |
| [`docs/presentation-notes.md`](docs/presentation-notes.md) | Presentation preparation |

---

## Future Improvements

> To be determined after problem statement analysis.

---

*Scaffold initialized. Problem statement not yet received.*
*Next step: Paste the official Odoo problem statement and run Phase 0 analysis.*
