# Testing Strategy

> Testing approach and targets. Specific test cases will be added during Phase 0.

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

**Target:** Service layer ≥ 80% coverage

```typescript
// Example: Service unit test
describe('UserService.createUser', () => {
  it('should throw DUPLICATE_ENTRY when email already exists', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({ id: 1 });
    await expect(userService.createUser({ email: 'test@test.com', ... }))
      .rejects.toThrow(AppError);
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
// Example: Integration test
describe('POST /api/v1/users', () => {
  it('should return 201 with created user data', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .send({ name: 'Test', email: 'test@test.com', password: 'Password123!' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).not.toHaveProperty('password');
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

# Specific test file
cd backend && npm test -- src/modules/users/users.test.ts
```

---

## Test Organization

```
backend/tests/
  ├── unit/
  │   ├── services/
  │   └── validators/
  ├── integration/
  │   └── api/
  └── validation/
      └── schemas/
```

Tests for a module may also live alongside the module:

```
backend/src/modules/users/
  └── users.test.ts
```

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

Coverage thresholds (enforced in CI):

| Layer | Threshold |
|-------|-----------|
| Services | ≥ 80% |
| Repositories | ≥ 70% |
| Validators | ≥ 90% |

**Coverage is a guide — not a substitute for meaningful tests.**

---

## Mocking Strategy

- Repositories are mocked in unit tests
- External services are mocked in unit tests
- Integration tests use real test database (no mocks)

---

*Last updated: scaffold initialization*
