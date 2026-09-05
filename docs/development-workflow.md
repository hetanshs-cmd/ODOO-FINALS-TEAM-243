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

*Last updated: scaffold initialization*
