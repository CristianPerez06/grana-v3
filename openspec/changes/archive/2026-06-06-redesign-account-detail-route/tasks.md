## 1. Tokens

- [x] 1.1 Add `--hero-navy-from`, `--hero-navy-to`, `--hero-navy-origin` to `packages/ui-tokens/src/theme.css`, referencing existing `--navy` / `--emerald-soft` variants where possible (no new raw hexes).
- [x] 1.2 Define `.bg-hero-navy` Tailwind utility composing the three tokens into `background-color` + `radial-gradient` (location: same `@theme` / `@utility` block convention used in `theme.css`, or `apps/web/app/globals.css` if utilities live there in v4 setup — pick at write time).
- [x] 1.3 Verify utility renders correctly in isolation (temporary preview or Storybook-style page) before wiring into the hero. _(Deferred to smoke-test 5.1 — utility verified inline in the hero render path.)_

## 2. Shared primitives — global restyle

- [x] 2.1 Restyle `apps/web/lib/transactions/components/movement-row.tsx`: grid `minmax(0,1fr) 126px 126px` desktop / `1fr 112px` mobile, running balance hidden below 760px, typography (title 13px font-semibold, meta 12px muted, monto tabular-nums with semantic `text-{tone}`).
- [x] 2.2 Restyle `apps/web/lib/transactions/components/movement-list.tsx`: day-group headers (`Hoy`, `Ayer`, formatted date), border-bottom rhythm, last-row no border. Behavior (filtering, running balance, empty states) unchanged.
- [x] 2.3 Restyle `apps/web/lib/transactions/components/movement-filters.tsx`: compact toolbar (month nav + icon buttons for search/recurrence/filters), active-filter chips row below. `showAccountFilter={false}` path unchanged. _(No code changes — existing toolbar already matches the design's compact icon-button + chips layout; verifying visually in 5.x.)_
- [x] 2.4 Restyle `apps/web/lib/transactions/components/pending-reimbursements-block.tsx`: count badge in header, per-item form layout matching `docs/design/accounts-detail/components/pending-reimbursements.html`. Outer `bg-muted/30` wrapper dropped; caller now provides the peer-card surface.
- [x] 2.5 Restyle `apps/web/lib/transactions/components/movement-list-skeleton.tsx` to match new row shape.

## 3. Account-detail page-level surfaces

- [x] 3.1 Restyle `apps/web/app/(app)/accounts/[id]/_components/account-detail-header.tsx` as the navy hero card: `.bg-hero-navy` surface, avatar 52px, name + institution·type, ARS 42px primary / USD 18px secondary, edit pencil top-right, `Archivada` chip recolored for navy (`bg-navy-soft` + `text-emerald`).
- [x] 3.2 Reshape the header's internal loading skeleton (the one rendered while `getAccountDetailAction` is pending) to mirror the navy hero card shape, not the old light skeleton.
- [x] 3.3 In `apps/web/app/(app)/accounts/[id]/_components/account-detail-content.tsx`, wrap the movements section in a peer card with its own surface (rounded white card, internal header `Movimientos` + CTA `+ Agregar transacción`, then filters and list inside).
- [x] 3.4 In `account-detail-content.tsx`, restyle the conditional `+ Agregar moneda` link as a pill (per `docs/design/accounts-detail/components/add-currency-link.html`); keep the `canAddCurrency` condition and the `href` to `/edit`.
- [x] 3.5 In `apps/web/app/(app)/accounts/[id]/_components/pending-reimbursements-account-container.tsx`, ensure the block renders as a peer card (white surface, rounded, separated from neighbors by the same gap as the other cards).

## 4. Loading state

- [x] 4.1 Rewrite `apps/web/app/(app)/accounts/[id]/loading.tsx`: three card placeholders (hero / reimbursements-or-empty / ledger). Back-link in `layout.tsx` is not replaced. Header internal skeleton (from 3.2) handles the first-paint render path; this file handles the segment-level fallback. Also widened layout to `max-w-3xl` so the ledger card breathes on desktop.

## 5. Visual smoke-test of all consumer routes

- [x] 5.1 `pnpm --filter web dev` and walk `/accounts/[id]` for: account with ARS+USD+transactions; account with only ARS; account with inactive currency (triggers `+ Agregar moneda`); archived account (visual check on chip); account with pending reimbursements; empty account. _(User: "Looks great".)_
- [x] 5.2 Cold-reload `/accounts/[id]`: back-link visible from first paint; no skeleton replaces chrome. _(Covered by 5.1 walk-through.)_
- [x] 5.3 Smoke `/transactions` — list, filters, chips, empty state, infinite paginate / load more. No regressions vs. pre-change behavior. _(User confirmed the restyled rows render on /transactions; peer-card wrapper intentionally scoped to /accounts/[id].)_
- [x] 5.4 Smoke `/transactions/[txId]` — detail hero unchanged (this is a separate visual surface), but movement-row context if any sub-list renders should look consistent. _(User confirmed at archive time: validated.)_
- [x] 5.5 Smoke `/cards/[id]` — `PeriodMovementsPane` + `MovementList` + `MovementRow`; verify the period UI still composes correctly around the restyled primitives. _(User confirmed at archive time: validated.)_

## 6. Quality gate

- [x] 6.1 `pnpm --filter web lint`. ✓ clean.
- [x] 6.2 `pnpm --filter web typecheck`. ✓ clean.
- [x] 6.3 Run any affected unit/integration tests touching `MovementList` / `MovementRow` / `MovementFilters` / `PendingReimbursementsBlock` and adjust snapshots / assertions for the restyle. _(No component tests for these primitives — only logic tests in `apps/web/lib/transactions/__tests__/*.ts`. All 345 web tests pass.)_
- [x] 6.4 `openspec validate redesign-account-detail-route --strict` passes.

## 7. Commit + branch

- [x] 7.1 Squash to a single commit on a feature branch (e.g. `feat/redesign-account-detail-route`), title-only conventional-commits format. → `a306ca69 feat(accounts): redesign detail page with navy hero + peer cards`
- [x] 7.2 Stop before merging to main (user merges manually).
