# Tests

Project-level test documentation.

- Backend tests live in `backend/tests/`
- Frontend tests live in `frontend/src/` alongside components

## Running All Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

## CI

Tests run automatically via GitHub Actions on every push and PR.
See `.github/workflows/quality-checks.yml`.

## Testing Strategy

See `docs/testing.md` for the full testing strategy.
