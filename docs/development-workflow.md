# Development Workflow

This document describes the complete development workflow for the team.

---

## Overview

```
Problem / Task
  ↓
Plan (Phase 0 for significant features)
  ↓
Create Feature Branch
  ↓
Implement (DB → Repo → Service → Controller → Route → Frontend → Tests)
  ↓
Self-Review
  ↓
Run Quality Checks
  ↓
Commit (Conventional Commits)
  ↓
Push
  ↓
Open Pull Request → dev
  ↓
Code Review
  ↓
Merge
  ↓
Demo-ready? → Merge dev → main
```

---

## Branch Strategy

```
main          ← stable, demo-ready only
  ↑
  dev         ← integration branch (all features merge here first)
    ↑
    feature/* ← new features
    fix/*     ← bug fixes
    docs/*    ← documentation changes
    test/*    ← test additions
```

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<description>` | `feature/user-authentication` |
| Bug fix | `fix/<description>` | `fix/login-validation-error` |
| Documentation | `docs/<description>` | `docs/api-endpoints` |
| Tests | `test/<description>` | `test/user-service-coverage` |

---

## Starting Work

```bash
# Always check your current branch first
git status
git branch --show-current

# Make sure dev is up to date
git checkout dev
git pull origin dev

# Create your feature branch
git checkout -b feature/your-feature-name

# Verify you're on the right branch
git branch --show-current
```

---

## Implementation Order

For significant features, always follow this order:

```
1. Phase 0 Analysis (if applicable)
2. Database migration (schema first)
3. Repository (SQL queries)
4. Service (business logic)
5. Controller (request parsing)
6. Route (HTTP binding)
7. Frontend service (API calls)
8. UI component
9. Tests
10. Documentation update
```

---

## Committing Safely

```bash
# 1. See what changed
git status

# 2. Review changes carefully
git diff

# 3. Stage only relevant files (NEVER blindly git add .)
git add backend/src/modules/users/users.service.ts
git add backend/src/modules/users/users.repository.ts
git add backend/migrations/002_create_sessions.sql

# 4. Verify staged files
git diff --staged

# 5. Commit with Conventional Commit format
git commit -m "feat(users): implement user registration service"
```

---

## Conventional Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Use When |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change (no new feature, no bug fix) |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `perf` | Performance improvement |
| `chore` | Build process, tooling, deps |
| `style` | Formatting only (no logic change) |

**Examples:**

```
feat(auth): implement JWT token generation
fix(users): prevent duplicate email registration
test(users): add service layer unit tests
docs(api): document user endpoints
refactor(db): extract query helpers to utils
perf(users): add index on email column
```

**Forbidden:**

```
fix
update
changes
wip
final
temp
```

---

## Pre-Commit Checklist

Before every commit:

```bash
# 1. Lint
npm run lint

# 2. Format check
npm run format:check

# 3. Run tests
npm test

# 4. Build (if needed)
npm run build

# 5. Check staged files
git diff --staged

# 6. Confirm .env is NOT staged
git status | grep ".env"
```

**If any step fails — FIX IT before committing.**

---

## Pull Requests

Every feature should be merged via Pull Request (never direct push to `dev` or `main`).

Flow:

```bash
# Push your feature branch
git push origin feature/your-feature-name

# Open PR on GitHub: feature branch → dev
# Fill in the PR template completely
```

PR must be reviewed by at least one other team member before merging.

---

## Code Review

When reviewing a PR:

1. Check architecture compliance (right layer for right logic)
2. Check for SQL injection risks
3. Check for hardcoded secrets
4. Check error handling
5. Check validation completeness
6. Check test coverage
7. Check documentation updates
8. Check mobile responsiveness (frontend)
9. Check accessibility (frontend)
10. Leave constructive comments

---

## Merging to main

Only merge `dev` → `main` when:

- All tests pass
- Feature is complete and working
- Team has reviewed
- Demo is ready

```bash
git checkout main
git merge dev --no-ff -m "chore(release): merge dev for demo v1"
git push origin main
```

---

## Conflict Resolution

If merge conflicts occur:

1. Do not panic
2. Do not blindly accept "theirs" or "ours"
3. Understand both changes
4. Discuss with the other person if needed
5. Resolve manually
6. Test after resolving
7. Commit the resolution

---

## What Never Goes In Git

```
.env
.env.local
node_modules/
dist/
build/
*.log
*.key
*.pem
secrets/
```

These are all listed in `.gitignore`.

---

## DealFlow360 — 24-Hour Execution Plan

Assumption: team of 4 (Backend-Lead, Backend-Support, Frontend-Lead, Frontend-Support).
Adjust the ownership table below if the actual team differs.

### Hour-by-Hour Blocks

**Block 1 — Hours 0–4: Foundation (whole team together)**
- Phase 0 docs (this pass — 30–45 min max, a means to unblock building, not a deliverable itself)
- `feature/db-schema`: write + run migrations 002–010 together (pair on this, it's the shared contract everyone codes against)
- `feature/auth`: internal JWT login + portal magic-link stub (a fake "always succeeds" token generator is fine for hour 2 — harden later)
- Frontend: scaffold both route trees (`/app/*` internal, `/portal/*` isolated), shared design tokens from existing `index.css`
- **Checkpoint:** everyone can log in (internal) and hit a stub portal route by hour 4

**Block 2 — Hours 4–9: The Core Engine** (Backend-Lead + Frontend-Lead pair here — highest value, highest risk)
- Backend-Support: Admin config CRUD (`/admin/products`, `/admin/discount-ceilings`, `/admin/warehouses`, etc.)
- Backend-Lead: **Discount rule engine** (`check-discounts`) — build as a pure function first, unit-test against the spec's own worked example (Gold customer, Hardware 12%/15% OK, Services 18%/10% over-by-8) before wiring to the API
- Backend-Lead: Approval workflow endpoints + audit log writes
- Frontend-Lead: Quotation Builder screen — product picker, cart, discount inputs, calls `check-discounts` on every edit
- Frontend-Support: Approvals List + Approval Detail screen (risk banner, per-line breakdown, stepper, action log)
- **Checkpoint by hour 9:** a rep can build a quote, an over-limit discount auto-creates an approval step, a manager can approve/reject it, and it's logged — this is the spine of the whole demo

**Block 3 — Hours 9–13: Fulfillment + Billing**
- Backend: Warehouse split algorithm — greedy allocation, minimize shipment count, backorder remainder
- Backend: Billing split on confirm — one-time → invoice, recurring → subscription + `next_bill_date`
- Frontend: Fulfillment Detail (split table, Accept/Override), Subscriptions/Billing Detail (one-time vs. recurring split view)
- **Checkpoint by hour 13:** an approved quote produces a correct warehouse split and correct invoice/subscription rows

**Block 4 — Hours 13–17: Customer Portal + Re-Approval Loop**
- Backend: Portal endpoints scoped strictly to `customer_portal_users`, row-level ownership checks on every query — don't skip this, it's graded explicitly as "must be a real restricted view"
- Backend: Confirm-quotation flow re-runs the discount engine from Block 2 — a thin wrapper, not new logic, if Block 2 was built as a clean reusable function
- Frontend: Portal Negotiation screen — read view, comment thread, counter-discount field, Submit/Confirm buttons
- **Checkpoint by hour 17:** submit a counter-discount as a customer that breaches threshold → confirm → verify it silently reappears in the Manager's approval queue

**Block 5 — Hours 17–20: Upsell/Cross-Sell + Deal Health**
- Backend: co-purchase ranking endpoint + margin-threshold filter
- Backend: three deal-health flag detectors (stalled / rep-relative anomaly / slippage) as a `node-cron` job
- Frontend: Upsell panel wired into Quotation Builder; Deal Health Dashboard (three panels, Escalate/Nudge buttons)
- **If time is tight, this block is the first cut candidate** — the spine (Blocks 1–4) is what the Quick Test Flow actually exercises

**Block 6 — Hours 20–24: Reporting, Seed Data, Rehearsal**
- Backend: reporting aggregation endpoint + PDF/XLS export
- Whole team: seed realistic demo data (a Gold customer with a mixed Hardware+Services quote guaranteed to trigger both a discount flag and a warehouse split — script this, don't rely on live demo luck)
- Full run-through of the spec's own 8-step Quick Test Flow, verbatim, at least twice before presenting
- Merge all `feature/*` branches into `dev`, then `dev` → `main` only once the full flow passes clean

### Module Ownership

| Person | Owns | Depends on |
|---|---|---|
| Backend-Lead | Discount engine, approval workflow, portal re-approval wiring | DB schema (Block 1) |
| Backend-Support | Admin CRUD, warehouse split, billing/subscriptions | DB schema, discount engine interfaces |
| Frontend-Lead | Quotation Builder, Upsell panel | Discount engine API contract |
| Frontend-Support | Approvals screens, Fulfillment/Billing screens, Portal Negotiation screen | Corresponding backend endpoints |

### Branches for This Feature Set

```
main  ← only merges from dev at Block-checkpoint boundaries (end of Block 2, 3, 4 minimum)
  ↑
 dev   ← integration branch, merge feature/* here after each block's checkpoint passes
  ↑
feature/db-schema, feature/auth, feature/discount-engine, feature/approvals,
feature/warehouse-split, feature/billing, feature/portal, feature/upsell,
feature/deal-health, feature/reporting
```

One feature branch per module, PR into `dev` at each checkpoint — not continuously, since
`quality-checks.yml` runs lint/typecheck/tests on every push and red pipelines mid-sprint on
unrelated branches burn time you don't have.

### Cut List (in order, if time runs out)

1. Reporting exports (PDF/XLS) — keep the raw filtered query, drop the export formatting
2. Upsell/cross-sell ranking — hardcode 2–3 static suggestions per category if genuinely out of time
3. Delivery-slippage flag type (keep stalled + anomaly, they're more demo-visible)
4. Credit-note auto-generation on subscription cancel — manual refund note is fine for demo

**Never cut:** the discount engine, the approval workflow, or the negotiation re-approval
loop — these three are the "business logic focus" and are what the Quick Test Flow is built
to exercise.

---

*Last updated: Phase 0 complete — DealFlow360*
