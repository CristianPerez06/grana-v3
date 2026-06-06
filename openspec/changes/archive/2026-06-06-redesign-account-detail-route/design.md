# Design: Redesign /accounts/[id] visual layout

## Context

The current `/accounts/[id]` lives in a narrow `max-w-2xl` column with every block as a sibling: identity, balances, conditional currency CTA, filters, list. The mocks in `docs/design/accounts-detail/` (README explicitly: "no information added, only reordered") propose a wider canvas with **peer cards** — a navy hero, a reimbursements card, a "+ Agregar moneda" pill, a "Movimientos" ledger card — and a restyled set of ledger primitives (filters bar, row, list) that should become the new global look across all routes that render movements.

The route, its data layer, and the shared primitives' behavior do **not** change. Only the visual treatment changes, plus the structural reshape of the page into peer cards.

Relevant existing pieces:
- Route shell: `apps/web/app/(app)/accounts/[id]/{page,layout,loading}.tsx`. Layout owns the back-link (chrome-always-visible rule, `route-loading-and-errors:184–185`).
- Page composition: `apps/web/app/(app)/accounts/[id]/_components/{account-detail-shell,account-detail-content,account-detail-header,pending-reimbursements-account-container,movement-filters-account-container,movement-list-account-container}.tsx`.
- Shared primitives (3 consumer routes — `/accounts/[id]`, `/transactions`, `/cards/[id]`): `apps/web/lib/transactions/components/{movement-filters,movement-list,movement-row,pending-reimbursements-block,movement-list-skeleton}.tsx`.
- Tokens: `packages/ui-tokens/src/theme.css` already exposes `--navy`, `--navy-muted`, `--navy-soft`, `--navy-border`, `--emerald`, `--emerald-deep`, `--emerald-soft`, `--emerald-bg`, plus Tailwind utilities (`bg-navy`, `text-emerald`, etc.).

## Goals / Non-Goals

**Goals:**
- Restructure `/accounts/[id]` as four peer cards (hero / reimbursements / currency pill / movements), preserving today's logical order.
- Adopt the navy hero card with the design's radial-gradient surface for account identity + balances.
- Restyle the shared ledger primitives so the new look applies globally to `/accounts/[id]`, `/transactions`, `/transactions/[txId]`, `/cards/[id]`.
- Author the hero gradient as new `ui-tokens` in "parts" form (start / end / origin) so a future mobile mirror can consume them via `expo-linear-gradient` without parsing CSS strings.
- Keep header chrome (back-link + action slots) visible from first paint; skeletons match the new card shapes.

**Non-Goals:**
- Mobile native `/accounts/[id]` (mock exists at `docs/design/accounts-detail/mobile/account-detail.html`; separate change once mobile movement form lands).
- TS mirror codegen of the new gradient tokens for mobile (separate follow-up).
- Behavioral changes: filtering, running balance rules, drawer wiring, edit flow, archive/delete (already in kebab on the list row) — all unchanged.
- Extending the new hero treatment to `/cards/[id]` hero or the `/transactions` page header — those are separate decisions.

## Decisions

### D1. Restyle shared primitives globally (Path A), but build the "Movimientos card" surface at the page-wrapper level

- The new look for **`MovementFilters` / `MovementList` / `MovementRow`** is applied directly to the shared components. All consumer routes inherit it.
- The new **outer "Movimientos" card** (rounded surface, internal section header + "Agregar transacción" CTA) is built in `account-detail-content.tsx`, **not** inside the shared primitive. Other routes wrap the same primitives in their own surfaces (`/transactions` has a different header, `/cards/[id]` has its own period UI).
- **Alternative considered**: scope every visual change to page-local wrappers and leave the shared primitives untouched (Path B). Rejected because the design intent is global; three drift-prone surfaces is worse than one global pass + a smoke-test of three routes.
- **Alternative considered**: extract a `<MovementCard>` wrapper primitive shared across routes (Path C middle). Rejected because the wrapper's shape (header copy, CTA, peer-card behavior) is route-specific; an abstraction here is premature.

### D2. Archived badge: same chip shape, recolored for navy surface

- Replace `bg-yellow-100 text-yellow-800` on the archived chip with `bg-navy-soft` + `text-emerald` (final shade settled during implementation; amber-on-navy is the alternative if visual review prefers it).
- **Alternative considered**: drop the chip, move "Archivada" to an eyebrow above the avatar. Rejected — chip is closer to the existing visual contract; consumers of `/accounts` already understand the chip semantically.

### D3. New `ui-tokens` for the navy hero gradient — parts shape, not gradient string

Add to `packages/ui-tokens/src/theme.css`:

```
--hero-navy-from: var(--emerald-soft);
--hero-navy-to: var(--navy);
--hero-navy-origin: 20% 0%;
```

Final color stops + origin will be picked during implementation to match the mock screenshot. Web composes them into a Tailwind utility `.bg-hero-navy` whose body is:

```
background-color: var(--hero-navy-to);
background-image: radial-gradient(circle at var(--hero-navy-origin), var(--hero-navy-from), transparent 60%);
```

(Authored in the same `theme.css` `@utility` block convention already used in this file, or in `apps/web/app/globals.css` if Tailwind v4 conventions in this repo expect utilities there — decided during implementation.)

- **Alternative considered**: ship a `--gradient-hero-navy: radial-gradient(...)` single CSS-string token (shape A). Rejected because React Native cannot consume the gradient string; mobile mirror would need to parse it. Parts shape is a strict superset that codegen-time tooling can re-export trivially.
- **Alternative considered**: inline Tailwind arbitrary value (`bg-[radial-gradient(...)]`). Rejected because the user expects to reuse this on mobile; a named token is the contract that survives platform changes.

### D4. Layout order: peer cards, today's logical order preserved (Option X)

```
1. Navy hero card           — identity, balances, edit
2. Reimbursements card      — conditional; restyled PendingReimbursementsBlock
3. "+ Agregar moneda" link  — conditional; restyled as pill
4. Movimientos card         — section header + filters + chips + list
```

- **Alternative considered**: tuck reimbursements as an inline strip inside the movements card (Option Y). Rejected — it forces the per-item confirm/cancel form into an expand-on-click pattern, which is a UX shift this change is not chartered for.

### D5. Skeleton reshape

`apps/web/app/(app)/accounts/[id]/loading.tsx` becomes three card placeholders (hero / reimbursements / ledger). The back-link in `layout.tsx` is never replaced by a skeleton (chrome rule). The header's internal skeleton (rendered while the TanStack query is pending inside `account-detail-header.tsx`) is reshaped to mirror the navy hero card layout.

## Risks / Trade-offs

- **Visual regression on `/transactions` and `/cards/[id]`** — restyling shared primitives ripples there. Mitigation: explicit smoke-test pass in tasks; screenshot diffs (manual) before considering the change done.
- **Token-shape vs. ergonomics** — authoring the gradient in parts is one extra CSS var compared to a single gradient string. Mitigation: utility class `.bg-hero-navy` keeps the consumer ergonomic; the parts are an internal contract.
- **Chip palette legibility on dark surface** — `bg-navy-soft` + `text-emerald` may not pass contrast for the "Archivada" label in all states. Mitigation: pick the actual shade during implementation against the screenshot; fall back to amber-on-navy if emerald reads weak.
- **Loading skeleton drift** — if the hero's final dimensions diverge from the skeleton placeholder, there's a layout jolt on data resolve. Mitigation: build skeleton from the same hero component's outer shell.
- **Spec scope on `transactions` capability** — the shared primitives' visual contract is spec'd inside `transactions/spec.md`. Changes there describe *visual* requirements only; behavioral scenarios stay untouched.

## Open Questions

- Exact final color stops + origin for `--hero-navy-*` tokens (picked during implementation by eyeballing the mock screenshot).
- Whether `.bg-hero-navy` lives in `packages/ui-tokens/src/theme.css` (with the rest of the `@theme` / `@utility` blocks) or in `apps/web/app/globals.css`. Decided at write-time based on which file already hosts utility-style additions.
- Final shade for the archived chip (emerald vs. amber on navy-soft). Resolved by visual eyeball during implementation.
