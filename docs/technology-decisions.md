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

## Decisions

> To be documented after Phase 0 analysis.

### Backend

*(Pending problem statement)*

---

### Frontend

*(Pending problem statement)*

---

### Database

*(Pending problem statement)*

**Key questions to answer:**
- Is the data relational or document-oriented?
- Do we need ACID transactions?
- What are the query patterns?
- What scale is expected?
- Does the team know how to design the schema for this database?

---

### Authentication Strategy

*(Pending problem statement)*

**Key questions:**
- Does the problem require user authentication at all?
- Are there roles / permissions?
- Should we build auth or integrate an auth provider?
- If JWT: what is the token lifetime strategy?

---

### Testing Tooling

*(Pending problem statement)*

---

### Infrastructure / Deployment

*(Pending problem statement)*

---

### External Services

*(List any external APIs, AI services, cloud storage, etc. decided during Phase 0)*

For each external service:

| Service | Purpose | Why Required | Fallback | Data Sent | Privacy |
|---------|---------|-------------|---------|---------|---------|
| | | | | | |

---

*Last updated: scaffold initialization — awaiting problem statement and Phase 0*
