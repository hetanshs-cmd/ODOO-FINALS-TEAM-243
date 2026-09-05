# dealStore Removal — Scoping Doc (Phase G/H)

## Why this doc exists

A request came in to remove every mock-backed piece from the site. Scoping
revealed this isn't a small fix — it's the already-tracked but
never-started **Phase G/H** from `docs/backend-gaps.md`: full removal of
`frontend/src/store/dealStore.ts` (a 2,450-line client-side mock store
persisted to `localStorage`) and everything still reading from it, plus
deletion of the store itself once nothing depends on it anymore.

`docs/backend-gaps.md`'s Phase G bullet only names 6 pages in passing
(`useCustomers`/`useUsers`, `FulfillmentPages`, `InvoicesPages`,
`SubscriptionsPages`, `DealHealthPage`, `CustomerPortalPages`) — three
Explore passes over the codebase turned up the **actual complete list**,
which is bigger and includes dead imports, dead service wrappers, and a
few features with no backend equivalent at all. This doc is that full
catalog, so a future session can execute the migration without re-deriving
it from scratch.

This is deliberately a documentation-only pass — no `dealStore` consumer
was touched this session (the Deal Health customer-name fix that prompted
this investigation is separate and already complete; see below).

## Related work already done this session

Not part of the dealStore migration, but found along the way: the Deal
Health alerts list (`GET /deal-health`) now joins `customers` server-side
and returns `customer_id`/`customer_name` on each alert
(`backend/src/modules/deal-health/deal-health.repository.ts`,
`frontend/src/services/apiTypes.ts`'s `ApiDealAlert`), so
`DealHealthPage.tsx` no longer needs to cross-reference `useQuotations` +
`useCustomers` client-side just to show a customer name on each card.

## `dealStore.ts` — full shape

A hand-rolled observable class (`DealStore`, singleton `dealStore`),
persisted to `localStorage` (`dealflow360_store_v4`), with
`getState()/setState()/subscribe()`.

**State keys:** `currentUser, isAuthenticated, selectedTeam, users,
customers, products, warehouses, discountTiers, categoryCeilings,
approvalRules, quotations, approvalSteps, subscriptionPlans,
subscriptions, invoices, negotiations, dealHealthFlags,
upsellSuggestions, timelineEvents, creditNotes, prorationEvents,
subscriptionBillingConfig, priceLists, upsellRules, reportingConfig,
configAuditTrail, dismissedUpsellIds, activeFulfillmentSplits,
lastRefreshedAt`.

**Actions:** `resetToSeed/resetDemoData, refreshData, setCurrentUser,
loginUser, logoutUser, logTimelineEvent, recalculateQuotation,
createQuotation, updateQuotation, addQuotationLine, removeQuotationLine,
updateLineQuantity, updateLineDiscount, updateOrderDiscount,
addUpsellToQuotation, dismissUpsell, submitQuotationForApproval,
approveQuotation, returnQuotation, rejectQuotation,
createNegotiationRequest, submitCustomerNegotiation,
addNegotiationMessage, confirmQuotation, applyNegotiationChange,
createFulfillment, acceptWarehouseSplit, overrideWarehouseSplit,
consolidateBackorderAction, restockWarehouse, createInvoice, getInvoice,
recordPayment, createSubscription, modifySubscription, cancelSubscription,
createCreditNote, updateCreditNoteStatus, updateSubscriptionBillingConfig,
logConfigAudit, saveProduct, archiveProduct, savePriceList,
saveCategoryCeiling, saveDiscountTier, saveApprovalRule, saveWarehouse,
toggleWarehouseActive, saveSubscriptionPlan, saveUpsellRule,
toggleUpsellRuleActive, saveReportingConfig`.

It embeds an entire client-side discount-governance / margin / risk /
approval-routing / proration / fulfillment-split engine (calls into
`domain/discounts`, `domain/margin`, `domain/fulfillment`,
`domain/billing`, `domain/deal-health`, `domain/permissions`) — this logic
has no 1:1 backend port; the real backend does its own governance
server-side against a flatter data model.

`frontend/src/hooks/useDealStore.ts` is a thin wrapper: subscribes to
`dealStore`, returns `{...state, ...every bound action}`. No selector —
every consumer re-renders on every store mutation, anywhere.

## Per-file consumer catalog

### Trivial — dead import, delete only
- **`frontend/src/pages/FulfillmentPages.tsx`** — imports `useDealStore`
  but the page body is already fully migrated onto
  `useSalesOrders/useCustomers/useUsers/useBackorders` +
  `warehouseService/productService/fulfillmentService/backorderService/
  salesOrderService`. Just remove the unused import.
- **`frontend/src/pages/InvoicesPages.tsx`** — same: imports `useDealStore`,
  never uses it; already runs on `useInvoices/useInvoice/useQuotations/
  useCustomers` + `billingService/quotationService`. Remove the import.

### Straightforward swap — real backend endpoints already exist
- **`frontend/src/pages/CommandCenterPage.tsx`** — reads
  `quotations, approvalSteps, dealHealthFlags, customers, users` (feeds an
  AI-context payload; `logTimelineEvent` is destructured but never called).
  Swap to `quotationService.getAll`, `approvalService.getAll`,
  `dealHealthService.listAlerts`, `customerService.getAll`,
  `userService.getAll`.
- **`frontend/src/pages/DashboardPage.tsx`** — reads `quotations,
  dealHealthFlags, approvalSteps, customers` via the same services above.
  The `upsellSuggestions` widget is the one piece with no backend
  equivalent (see "No backend equivalent" below) — migrate everything
  else, decide the widget separately.
- **`frontend/src/pages/admin/AdminProductsConfigPage.tsx`** — products
  half only: swap to `adminService.products` (mirrors what
  `productService.getAll/getById` already delegates to). Price lists need
  new backend support — see below.
- **`frontend/src/pages/admin/AdminSubscriptionsPage.tsx`** — plans half
  only: swap to `adminService.subscriptionPlans` (already exposed as
  `subscriptionService.plans`). Billing-policy config needs new backend
  support — see below.
- **`frontend/src/pages/ReportsAndProductsPages.tsx`** (`ProductsPage`) —
  reads `products`; swap to `productService.getAll` (note: ADMIN-gated
  today, same caveat already documented on `productService` itself).

### Needs new backend endpoint(s) — no equivalent exists today
- **Price-list CRUD** (`AdminProductsConfigPage.tsx`'s `savePriceList`) —
  no `priceListService` or `/admin/price-lists` route anywhere.
- **Subscription billing-policy config**
  (`AdminSubscriptionsPage.tsx`'s `subscriptionBillingConfig` /
  `updateSubscriptionBillingConfig` — proration rule, cancellation refund
  rule, credit-note prefix, mid-cycle-upgrade toggle) — no matching
  endpoint.
- **Upsell-suggestions widget** (`DashboardPage.tsx`) — only a per-product
  recommendations endpoint exists (`productService.getRecommendations`),
  not an aggregate/global feed the dashboard widget needs.
- **Rich reporting breakdowns** (`ReportsPage.tsx` +
  `reportingService.ts`'s `getReportData` — category breakdown, rep
  performance, approval performance, stage pipeline, PDF/XLS export
  inputs) — only coarse `reportingBackendService.salesSummary` and
  `.discountExceptions` (`/reports/sales-summary`,
  `/reports/discount-exceptions`) exist; nowhere near the same granularity.

### Already explicitly out of scope (product decision on record)
- **`frontend/src/pages/admin/AdminReportingConfigPage.tsx`** —
  `docs/backend-gaps.md` already decided this stays client-side/
  `localStorage`; no backend module or table backs it, and that's
  intentional. Leave as-is; not part of this migration.

### Needs redesign, not just a swap
- **`frontend/src/pages/QuotationDetailPage.tsx`** (heaviest consumer) —
  reads `quotations, customers, products, dismissedUpsellIds,
  timelineEvents, approvalSteps`; calls `updateQuotation,
  addQuotationLine, removeQuotationLine, updateLineQuantity,
  updateLineDiscount, updateOrderDiscount, addUpsellToQuotation,
  dismissUpsell, submitQuotationForApproval, createQuotation,
  logTimelineEvent, recalculateQuotation`. The live per-line
  discount/recalculation editing loop has no 1:1 backend analogue — the
  server recomputes discount risk on submit/`check-discounts`, not on
  every keystroke, so this needs a UX rethink (e.g. debounce + call
  `checkDiscounts`, or accept a coarser recompute cadence), not a
  mechanical hook swap. Upsell dismiss/accept state
  (`dismissedUpsellIds`/`addUpsellToQuotation`/`dismissUpsell`) also has no
  persisted server-side concept yet. The timeline read
  (`timelineEvents` filtered by quotation) *can* swap directly to
  `quotationTimelineService.getForQuotation` /
  `GET /quotations/:id/timeline` (already real, audit-log-backed) — only
  the client-side `logTimelineEvent` **write** needs to be dropped in
  favor of the server's automatic audit logging on real actions.

### Auxiliary modules
- **`frontend/src/services/eventBus.ts`** — reads
  `dealStore.getState().currentUser`/`.timelineEvents`, writes via
  `dealStore.setState(...)`. Pure mock-only audit shim with no real
  equivalent needed once its callers move to real actions (whose audit
  trail is written server-side automatically as a side effect) — should be
  **deleted**, not ported.
- **`frontend/src/services/reportingService.ts`** — reads
  `dealStore.getState()` wholesale (`quotations, users, approvalSteps,
  upsellSuggestions, products`) plus `currentUser` for exports. Same gap as
  `ReportsPage.tsx` above — needs new backend endpoints before it can be
  retired, not a simple swap.

### Not actually a dealStore consumer (false positives, confirmed)
- `frontend/src/hooks/useAuth.ts` — already 100% real-backed
  (`authService`/`tokenStore`); a comment only *mentions* dealStore to say
  it has no dependency on it.
- `frontend/src/services/apiTypes.ts` — no `dealStore` import at all.

### Role-switcher (Phase H) — already done
`frontend/src/App.tsx` and `frontend/src/layouts/InternalShell.tsx` have
no dealStore usage and no role-switcher logic left — both already run on
`useAuth`/real role gating. `LoginPage.tsx`'s `quickLogin(role, ...)` is
already backed by `authService.quickLoginByRole` (real backend). **The
role-switcher-removal half of Phase H is already complete** — Phase H's
remaining work is purely `dealStore.ts` deletion, gated on Phase G.

## Mock-backed service wrappers in `frontend/src/services/index.ts`

All four of these are confirmed **dead code as direct imports** — no page
calls the wrapper function itself; pages instead call the underlying
`domain/*` pure function directly against `dealStore`'s local data. Listed
here because deleting `dealStore.ts` requires either deleting these
wrappers too or repointing them at something real.

- **`discountService`** (`getRules`/`validateDiscount`/`evaluateRisk`) —
  real per-quotation evaluation already exists and is used elsewhere
  (`POST /quotations/:id/check-discounts`, wired via
  `quotationService.checkDiscounts`/`.submit`). A real rule-table read
  endpoint exists too (`GET /admin/discount-rules`,
  `adminService.discountRules`) but it's **ADMIN-only** — no
  SALES_REP/SALES_MANAGER-readable route exists, and those are exactly the
  roles that currently read `dealStore.discountTiers`/`categoryCeilings`
  directly (`ApprovalsPages.tsx`, `QuotationDetailPage.tsx`) for live
  ceiling/risk display. Needs either a relaxed-role read endpoint or a
  redesign around `check-discounts`' per-quotation result instead of a raw
  rule fetch.
- **`permissionService`** (`can(user, action, resource)`) — backend RBAC is
  flat `requireRole(...)` per route; there's no FINANCE role server-side
  (unlike the mock's `finance` role), and approval step-ordering is
  enforced **inside** `approvals.service.ts` using the approval's own
  `approval_level_id`, not derivable from `user.role` alone. Real callers
  today: `ReportsPage.tsx`, `FulfillmentPages.tsx`,
  `CancellationModal.tsx` (all via `canUserPerformAction` directly, not the
  dead wrapper); `ApprovalsPages.tsx` already runs a simplified
  role-only heuristic (comment on file notes this); `InvoicesPages.tsx`
  already simplified to "always allowed, backend 403s if not." A real
  replacement needs `user.role` (already real via `useAuth`) plus, for
  step-order-sensitive checks, the `approval_level_id` field already
  present on `GET /approvals/:id` responses — not a resurrected mock
  engine.
- **`timelineService`** (dealStore-backed — distinct from the already-real
  `quotationTimelineService`) — dead wrapper; real callers go straight
  through `useDealStore().timelineEvents`/`.logTimelineEvent`
  (`QuotationDetailPage.tsx`, `CommandCenterPage.tsx`, `eventBus.ts`, and
  ~30 internal call sites inside `dealStore.ts` itself, logging on nearly
  every mutation). A real, already-built replacement exists:
  `quotationTimelineService.getForQuotation` →
  `GET /quotations/:id/timeline` (audit-log-backed). Migration = repoint
  reads there and stop the client-side writes (the server already logs
  real actions to `audit_logs` automatically).
- **`warehouseService.getAll`'s 403→dealStore fallback** — only live caller
  is `FulfillmentPages.tsx`'s Stock tab. No non-admin-readable warehouse
  endpoint exists (`/admin/warehouses` is ADMIN-gated via
  `requireRole('ADMIN')` on the whole `/admin/*` tree). Needs a new
  `GET /warehouses` directory route (mirroring the `customers`/`users`
  directory pattern already used elsewhere) or a relaxed role list
  specifically on the existing GET.

## Open decision — not resolved, flagged for whoever picks this up

The "needs new backend endpoint(s)" bucket above (price lists, subscription
billing-policy config, the Dashboard upsell widget, ReportsPage's rich
breakdowns) was raised mid-scoping with a recommendation to **drop or
simplify** these — matching the precedent already set for
`AdminReportingConfigPage` (explicitly decided to stay client-side rather
than get a backend module) — instead of building brand-new backend modules
just to preserve mock-only features. That decision was **deferred, not
made** — a future session should either confirm "drop/simplify" as the
default, or scope full backend parity for these four items explicitly
before starting.

## Suggested execution sequencing (not executed this session)

1. **Backend branch** (PR to `dev`): any new endpoints decided on above —
   at minimum, if kept, a non-admin-readable warehouse directory route;
   optionally price-list CRUD / billing-policy config / rich reporting
   endpoints depending on the open decision.
2. **Frontend branch** (PR to `dev`): trivial dead-import deletions first
   (`FulfillmentPages.tsx`, `InvoicesPages.tsx`), then the straightforward
   swaps (`CommandCenterPage.tsx`, `DashboardPage.tsx` minus the upsell
   widget, the products/plans halves of the two admin config pages,
   `ReportsAndProductsPages.tsx`), then the four service-wrapper
   migrations (discount/permission/timeline/warehouse).
3. **`QuotationDetailPage.tsx` redesign** + permission-model rewrite last —
   highest-regression item, do it in isolation with its own test pass.
4. **Delete** `dealStore.ts`, `useDealStore.ts`, `seedData.ts`,
   `eventBus.ts`, `reportingService.ts` (mock), and the four dead service
   wrappers in `services/index.ts`, only once a repo-wide grep for
   `dealStore`/`useDealStore` returns zero hits.
5. Update `docs/backend-gaps.md`'s Phase G/H bullets to "done" and remove
   the pointer to this doc once complete (or archive this doc).
