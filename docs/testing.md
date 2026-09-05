# Testing Strategy — DealFlow360

> Phase 0 complete. Coverage targets confirmed per NFR5.

---

## Testing Philosophy

- Tests verify behavior, not implementation details.
- Tests give confidence to refactor.
- Untested code is technical debt.
- Coverage numbers guide; meaningful tests matter more.

---

## Test Types

### Unit Tests

Test business logic in isolation.

- Test services independently (mock repositories)
- Test validators
- Test utility functions
- Test edge cases

**Targets (NFR5):**
- Discount engine (`discountEngine.ts`, `discount-engine.service.ts`) ≥ 70% — highest-risk logic
- Warehouse-split service ≥ 70%
- All other service layers ≥ 80%

```typescript
// Real example from auth.test.ts
describe('authService.login', () => {
  it('gives the same error for unknown email and wrong password', async () => {
    // Prevents email enumeration — same code + message in both cases
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);
    let unknownEmailError: AppError | undefined;
    try { await authService.login('ghost@example.com', 'pw'); }
    catch (e) { unknownEmailError = e as AppError; }

    const user = await makeUser();
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(user);
    let wrongPasswordError: AppError | undefined;
    try { await authService.login(user.email, 'wrong'); }
    catch (e) { wrongPasswordError = e as AppError; }

    expect(unknownEmailError?.code).toBe(wrongPasswordError?.code);
    expect(unknownEmailError?.message).toBe(wrongPasswordError?.message);
  });
});
```

---

### Integration Tests

Test API endpoints with a real test database.

- Test full request → response cycle
- Test authentication/authorization
- Test database interactions
- Test concurrent scenarios

**Target:** All critical API endpoints covered

```typescript
// Real example — health endpoint integration test
describe('GET /api/v1/health', () => {
  it('should return 200 with db latency', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.dbLatencyMs).toBeTypeOf('number');
  });
});
```

---

### Validation Tests

Test that invalid input is correctly rejected.

- Missing required fields
- Invalid email formats
- Out-of-range values
- Wrong data types
- Cross-field constraint violations

**Target:** Comprehensive coverage of all validators

---

### Edge Case Tests

```
[ ] Empty data sets
[ ] Single-record edge cases
[ ] Duplicate records
[ ] Missing / null records
[ ] Invalid IDs
[ ] Unauthorized actions
[ ] Boundary values (min, max, off-by-one)
[ ] Large payloads
[ ] Concurrent requests where relevant
```

---

## Test Database

Integration tests use a **separate test database** (not the development database).

Configure in `.env.test`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/hackathon_test
```

Test database is created, migrated, and torn down automatically during CI.

---

## Running Tests

```bash
# All tests
cd backend && npm test

# Watch mode (development)
cd backend && npm run test:watch

# Coverage report
cd backend && npm run test:coverage

# Specific module test
cd backend && npm test -- src/modules/auth/auth.test.ts
cd backend && npm test -- src/modules/discount-engine/
```

---

## Test Organization

```
backend/tests/
  ├── unit/
  │   └── pagination.test.ts
  └── integration/
      └── health.test.ts

# Module-level tests live alongside the module:
backend/src/modules/
  ├── auth/
  │   └── auth.test.ts          ← 14 unit tests (mocked repo)
  ├── discount-engine/
  │   └── discountEngine.test.ts ← tests pure engine function
  └── <module>/
      └── <module>.test.ts
```

**Unit tests mock the repository layer** (no DB needed, fast). 
**Integration tests** in `backend/tests/integration/` use the real test DB (port 5433).

---

## CI Testing

Tests run automatically in GitHub Actions on every push and PR.

See: [`.github/workflows/quality-checks.yml`](../.github/workflows/quality-checks.yml)

---

## Test Coverage

Coverage report generated with:

```bash
cd backend && npm run test:coverage
```

Coverage thresholds (enforced in CI — NFR5):

| Target | Threshold | Why |
|--------|-----------|-----|
| `discount-engine` module | ≥ 70% | Highest-risk business logic |
| Warehouse-split service | ≥ 70% | Complex allocation algorithm |
| All other services | ≥ 80% | General service layer target |
| Repositories | ≥ 70% | SQL correctness |
| Validators | comprehensive | Every invalid input shape |

**Coverage is a guide — not a substitute for meaningful tests.**

---

## Mocking Strategy

- Repositories are mocked in unit tests
- External services are mocked in unit tests
- Integration tests use real test database (no mocks)

---

## Priority Test Cases (Viva-critical)

| Module | Test case | Why it matters |
|--------|-----------|----------------|
| Auth | Same error for unknown email vs wrong password | Prevents email enumeration |
| Auth | Magic-link is one-time use | Security |
| Auth | Magic-link expires after 15 min | Security |
| Auth | `password_hash` never in response | Data exposure prevention |
| Discount engine | Strictest ceiling wins across scopes | Core FR2 rule |
| Discount engine | No matching rule → ceiling is 0 | Safe-by-default |
| Discount engine | Blended score weights three signals | FR3 |
| Portal | Customer cannot access another customer's quotation | NFR2, row-level isolation |
| Portal | Counter-discount re-enters approval if over threshold | FR9 |
| Fulfillment | Shortfall produces backorder, not silent failure | FR6 |

---

*Last updated: Phase 0 complete — DealFlow360*
