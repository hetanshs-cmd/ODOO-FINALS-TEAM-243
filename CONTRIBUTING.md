# Contributing Guide

> Read this before making any changes to the codebase.

---

## Before You Start

1. Understand the current state of the code you're touching.
2. For significant features, complete Phase 0 analysis first (see [`.agents/AGENTS.md`](.agents/AGENTS.md)).
3. Create a feature branch — **never commit directly to `dev` or `main`**.
4. Assign yourself to the relevant issue if one exists.

---

## Branch Naming

| Work Type | Pattern | Example |
|-----------|---------|---------|
| Feature | `feature/<description>` | `feature/user-registration` |
| Bug fix | `fix/<description>` | `fix/email-validation` |
| Documentation | `docs/<description>` | `docs/api-endpoints` |
| Test | `test/<description>` | `test/user-service` |

Use kebab-case, keep it short and descriptive.

---

## Git Workflow

```bash
# 1. Start from an updated dev branch
git checkout dev
git pull origin dev

# 2. Create your feature branch
git checkout -b feature/your-feature

# 3. Work on your feature
# ... implement ...

# 4. Check what you're about to commit
git status
git diff

# 5. Stage ONLY relevant files
git add backend/src/modules/users/users.service.ts

# 6. Commit with Conventional Commit format
git commit -m "feat(users): add user registration logic"

# 7. Push your branch
git push origin feature/your-feature

# 8. Open a Pull Request: feature branch → dev
# Fill in the PR template completely
```

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `perf`, `chore`, `style`

**Examples:**
```
feat(auth): implement JWT token generation
fix(users): handle duplicate email registration
test(users): add service unit tests
docs(api): document user endpoints
```

**Forbidden:** `fix`, `update`, `changes`, `wip`, `final`, `asdf`

---

## Pull Requests

- All work goes through Pull Requests into `dev` — no direct commits.
- Fill in the PR template completely.
- At least one other team member must review and approve before merging.
- All CI checks must pass before merging.

---

## Code Review

As a **reviewer**:
- Check architecture compliance (right logic in right layer)
- Check for SQL injection vulnerabilities
- Check for hardcoded secrets
- Check validation completeness
- Check test coverage
- Check documentation updates
- Leave constructive, specific comments

As a **PR author**:
- Respond to all review comments
- Do not merge until all conversations are resolved

---

## Code Ownership

| Module | Owner |
|--------|-------|
| Architecture / Integration | Member 1 |
| Backend / API | Member 2 |
| Frontend / UI | Member 3 |
| Testing / Docs | Member 4 |

> Do not modify another person's module without explaining why and getting their review.

---

## Pre-Commit Checklist

Before committing:

```bash
cd backend && npm run lint
cd backend && npm run format:check
cd backend && npm test
cd backend && npm run typecheck

cd frontend && npm run lint
cd frontend && npm run typecheck
```

**If anything fails — fix it before committing.**

---

## Testing Requirements

Every PR that adds behavior must include tests:

- **New service function** → unit test
- **New API endpoint** → integration test
- **New validator** → validation test
- **Bug fix** → regression test

---

## Documentation

Every PR that changes:
- The database → update `docs/database.md`
- Any API endpoint → update `docs/api.md`
- The architecture → update `docs/architecture.md`
- The setup → update `README.md`
- Any feature → update `docs/presentation-notes.md`

---

## Conflict Resolution

If you have a merge conflict:

1. Do NOT blindly accept "ours" or "theirs".
2. Understand both changes.
3. Talk to the other person if needed.
4. Resolve manually.
5. Test after resolution.

---

## Questions

If you're unsure about a decision, discuss with the team before implementing.
It's always faster to spend 5 minutes discussing than to rework 5 hours of code.
