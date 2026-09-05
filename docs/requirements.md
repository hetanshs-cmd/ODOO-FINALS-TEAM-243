# Requirements — DealFlow360

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Product / price-list / customer CRUD with tier assignment |
| FR2 | Per-line discount check against the **strictest** of (tier ceiling, category ceiling) |
| FR3 | Blended risk scoring across all lines → routes to 0/1/2-step approval chain |
| FR4 | Immutable audit log on every approval action |
| FR5 | Ranked upsell / cross-sell suggestions filtered by margin threshold |
| FR6 | Warehouse split minimizing shipment count, with backorder handling and auto-consolidate-on-restock |
| FR7 | Hybrid billing — one-time invoices + recurring subscriptions with proration |
| FR8 | Isolated customer portal — view, comment, counter-discount, confirm |
| FR9 | Negotiation confirm re-runs FR2/FR3; re-enters approval if breached |
| FR10 | Deal health — three independent flag types (stalled / rep-relative discount anomaly / delivery slippage) |
| FR11 | Filterable reporting (period/team/status/product) with PDF/XLS export |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Security | NFR1 — All business rules are enforced server-side only, never trusted from the client |
| Security | NFR2 — Portal auth is fully separate from internal auth (no shared session/table) |
| Security | Passwords hashed with bcrypt (work factor ≥ 12) |
| Security | All secrets in environment variables |
| Security | Parameterized SQL only |
| Maintainability | NFR3 — Every schema change via a numbered migration only, never hand-edited |
| Usability | NFR4 — All 4 UI states (loading / empty / error / success) on every screen |
| Testability | NFR5 — 70% test coverage floor on the discount engine and warehouse-split functions specifically (highest-risk logic); 80% floor on the service layer generally |
| Performance | API responses < 500ms for 95th percentile under expected load |
| Scalability | System should handle growth in users and records without architecture changes |
| Accessibility | WCAG 2.1 AA compliance for all user-facing UI |
| Reliability | Graceful error handling; no unhandled promise rejections |
| Usability | All forms provide inline validation feedback |
| Maintainability | Modular architecture; each layer has single responsibility |

---

## Phase 0 Checklist

```
[x] Problem understanding documented
[x] Target users identified
[x] User journeys mapped
[x] Functional requirements listed (FR1-FR11)
[x] Non-functional requirements listed (NFR1-NFR5 + general)
[x] Core features identified
[x] Optional / stretch features identified
[x] Edge cases identified
[x] At least 2 architectural approaches evaluated
[x] Recommended architecture chosen with justification
[x] Database entities identified
[x] ER diagram created
[ ] API contracts fully defined per module (in progress, see api.md)
[x] Team module assignments decided
[x] Implementation order planned
```

---

*Last updated: Phase 0 complete — DealFlow360*
