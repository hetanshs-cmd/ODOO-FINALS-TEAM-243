# Technology Decisions

> ⚠️ This document will be populated during Phase 0 analysis, after the official problem statement is received.
>
> **Do not fill this document with assumptions. Fill it with justified decisions.**

---

## Policy

**THE PROBLEM DETERMINES THE STACK. NOT THE OTHER WAY AROUND.**

Technology is selected after understanding:
1. What the problem requires
2. What the data model looks like
3. What the user experience requires
4. What performance characteristics are needed
5. What the team can build, debug, and explain under hackathon conditions

---

## Hard Constraints

| Constraint | Rule |
|-----------|------|
| Primary backend | Must be built and owned by the team |
| Primary database | Local, team-controlled database strongly preferred |
| Firebase / Supabase | **Forbidden as primary backend/database architecture** |
| External services | Allowed only when they provide genuine, justified value |

---

## Decision Template

For every major technology decision, complete this template:

---

### Technology: [Name]

**Purpose:**
> What does it do in this project?

**Alternatives considered:**
> What else was evaluated?

**Why selected:**
> What specific requirement or characteristic makes this the right choice?

**Advantages:**
> What does it do well?

**Disadvantages / Trade-offs:**
> What does it do poorly? What did we give up?

**Security considerations:**
> Are there security implications? How are they handled?

**Scalability considerations:**
> How does it behave under growth?

**Team familiarity:**
> Can the team build with, debug, and explain this technology?

**Fallback:**
> What happens if this technology fails or is unavailable?

---

## Decisions — DealFlow360

| Decision | Choice | Reasoning |
|---|---|---|
| Backend runtime | Node.js + Express (already scaffolded) | Fast iteration on a rule-heavy service layer within a 24h window; team already has a TS scaffold in place |
| Database | PostgreSQL (already scaffolded, docker-compose) | FK integrity across approval steps, billing splits, and the audit trail — relational by nature, not document-shaped |
| ORM / query layer | Raw parameterized `pg` queries or Kysely (lightweight, type-safe, no new migration tooling) | The scaffold's `database.ts` already documents a parameterized-only pattern; avoid introducing Prisma's separate migration system mid-build |
| Frontend | React + Vite (already scaffolded) | Two isolated route trees (internal vs. portal) with fast dev-server iteration |
| Scheduled jobs | `node-cron` in-process | Deal-health and billing-cycle checks need to run periodically; a second process is unjustified overhead at hackathon scale (see `architecture.md` §Approach B) |
| Discount risk scoring | Rule-based weighted formula (v1); optional logistic-regression layer (v2, if time allows) | FR3 needs a working answer immediately; an ML layer is additive polish, not core path |

### Backend

Node.js + Express + TypeScript, layered monolith (Route → Controller → Service → Repository).

### Frontend

React + Vite + TypeScript, two isolated route trees: `/app/*` (internal) and `/portal/*` (customer).

### Database

PostgreSQL, relational — FK-heavy domain (approvals, billing, audit trail) requires ACID
transactions and referential integrity that a document store would not enforce for free.

### Authentication Strategy

Two fully separate schemes, per NFR2:
- **Internal (rep/manager/admin):** JWT, short-lived access token.
- **Portal (customer):** magic-link token, no shared session/table with internal auth.

### Testing Tooling

Vitest (already scaffolded for backend). 70% coverage floor on discount engine and
warehouse-split functions specifically (NFR5); 80% floor on the service layer generally.

### Infrastructure / Deployment

Docker Compose for local Postgres; backend and frontend run as local dev servers
(`http://localhost:4000`, `http://localhost:5173`) for the hackathon demo.

### External Services

None required — all business logic is built and owned by the team per the hard constraint
that Firebase/Supabase are forbidden as primary backend/database architecture.

| Service | Purpose | Why Required | Fallback | Data Sent | Privacy |
|---------|---------|-------------|---------|---------|---------|
| — | — | — | — | — | — |

---

*Last updated: Phase 0 complete — DealFlow360*
