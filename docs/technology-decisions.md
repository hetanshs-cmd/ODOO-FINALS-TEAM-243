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
| AI layer local model | Ollama (`qwen2.5:3b-instruct`), called from `backend/src/modules/ai/` via Node's built-in `fetch` | Fully local/team-owned per the hard constraint above (no external SaaS model API); small enough for CPU-only demo laptops; zero new npm dependencies since Node ≥22 ships global `fetch` |

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
that Firebase/Supabase are forbidden as primary backend/database architecture. The one
model dependency (Ollama) runs entirely locally, not as a hosted third-party API — see
below.

| Service | Purpose | Why Required | Fallback | Data Sent | Privacy |
|---------|---------|-------------|---------|---------|---------|
| — | — | — | — | — | — |

---

### Technology: Ollama (local LLM runtime)

**Purpose:** Runs a small instruction-tuned model (`qwen2.5:3b-instruct`) locally so
`backend/src/modules/ai/` can answer grounded quotation/approval/deal-health/negotiation/
report questions and back the workspace chatbot with real generated text, instead of only
the deterministic `contextualAIAdapter` templates.

**Alternatives considered:** llama.cpp server (lighter binary, more manual model/GGUF
management); `node-llama-cpp` in-process (couples model lifecycle to the API process,
heavier native-binding dependency); a hosted model API (OpenAI/Anthropic/etc.) — rejected
outright, it would violate the hard constraint that all logic stay team-owned/local, and
it would send workspace data to a third party.

**Why selected:** Runs as a simple local background service, has the largest/easiest model
library, and exposes a plain HTTP API reachable from Node's built-in `fetch` — no new npm
dependency at all.

**Advantages:** Zero external network calls once installed; simple `ollama pull <model>` +
`ollama serve` setup; swapping models is an env-var change (`OLLAMA_MODEL`), not a code
change.

**Disadvantages / Trade-offs:** Requires a teammate/judge to have Ollama installed and the
model pulled locally for the AI features to produce real model output; answer quality/
latency depends on the machine's CPU.

**Security considerations:** All traffic stays on `localhost` by default (`OLLAMA_BASE_URL`);
no workspace data leaves the machine. Requests are bounded by `OLLAMA_TIMEOUT_MS` so a hung
model can't hang an API request.

**Scalability considerations:** Single local process, not designed to serve concurrent
production traffic — acceptable for this project's scope (an internal workspace tool, not
a public high-throughput service).

**Team familiarity:** Simple HTTP contract (`POST /api/chat`), no SDK to learn.

**Fallback:** If `OLLAMA_ENABLED=false`, Ollama isn't running, or a request times out/returns
malformed JSON, `backend/src/modules/ai/ollama.client.ts` throws a single `AI_UNAVAILABLE`
(503) error and the frontend's `aiService` falls back to the existing deterministic
`contextualAIAdapter` templates — the AI panels keep working either way.

---

*Last updated: Phase 0 complete — DealFlow360*
