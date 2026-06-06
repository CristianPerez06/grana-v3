# Redesign /accounts/[id] visual layout

## Why

`/accounts/[id]` works functionally but visually treats every block — identity, balances, currency CTA, filters, list — as siblings inside a narrow `max-w-2xl` column. The design dropped in `docs/design/accounts-detail/` reframes the route as **"la cuenta como centro operativo"**: a wide navy hero card carrying identity + balances, and a separate ledger card carrying the movements section. Same data, clearer hierarchy.

We also want this new visual language to become the global look for the ledger primitives (`MovementFilters`, `MovementList`, `MovementRow`) so `/transactions` and `/cards/[id]` inherit it for free, instead of three routes drifting apart.

## What Changes

- **Page-level surface (`/accounts/[id]`)**: introduce a navy hero card (avatar + name + institution·type + ARS/USD balances + edit pencil), a peer reimbursements card, a restyled "+ Agregar moneda" pill, and a new "Movimientos" peer card that wraps the section header + filters + list.
- **Shared primitives (global restyle)**: update `MovementFilters`, `MovementList`, `MovementRow` in `apps/web/lib/transactions/components/` to the new visual language. `/transactions`, `/transactions/[txId]`, `/cards/[id]` inherit the new look — no requirement changes there, only visual updates.
- **Archived badge** on the new navy hero: recolored chip (`bg-navy-soft` + emerald/amber text) instead of `bg-yellow-100`.
- **New `ui-tokens` for the hero gradient** (parts shape so mobile codegen can reuse later): `--hero-navy-from`, `--hero-navy-to`, `--hero-navy-origin`, exposed via a `.bg-hero-navy` web utility.
- **Loading state**: reshape `loading.tsx` to mirror the new peer-card layout. Back-link in `layout.tsx` stays visible from first paint (chrome rule unchanged).
- No data-layer changes. No new routes. No new behavior beyond visual.
- Mobile native equivalent is **OUT of scope**; tracked as a follow-up change.

## Capabilities

### New Capabilities

_None._ This change is a visual rework over existing capabilities; no new behavioral surfaces are introduced.

### Modified Capabilities

- `accounts`: requirements describing the visual structure of `/accounts/[id]` (account detail header, balances layout, page-level composition) change to reflect the navy hero + peer cards layout. Skeleton shape in `loading.tsx` updates to match.
- `transactions`: requirements describing the visual contract of the shared ledger primitives (`MovementFilters`, `MovementList`, `MovementRow`, `PendingReimbursementsBlock` as rendered inside `/accounts/[id]`) update to the new visual language. Behavioral requirements (filtering, running balance, empty states, drawer wiring) unchanged.

## Impact

- **Affected routes**: `/accounts/[id]` (primary), `/transactions`, `/transactions/[txId]`, `/cards/[id]` (visual ripple from shared primitives).
- **Affected code**:
  - `apps/web/app/(app)/accounts/[id]/_components/{account-detail-header,account-detail-content,pending-reimbursements-account-container}.tsx`
  - `apps/web/app/(app)/accounts/[id]/loading.tsx`
  - `apps/web/lib/transactions/components/{movement-filters,movement-list,movement-row,pending-reimbursements-block,movement-list-skeleton}.tsx`
  - `packages/ui-tokens/src/theme.css` (new gradient tokens + utility)
- **Dependencies**: none added. Uses existing `@grana/ui-tokens` (`--navy`, `--emerald`, `--emerald-soft`, etc.).
- **Data layer**: no changes. All server actions, query keys, and caching unchanged.
- **Mobile**: no impact today. Gradient is authored in parts so a future mobile mirror via codegen (`<LinearGradient>` / radial equivalent) is trivial.
