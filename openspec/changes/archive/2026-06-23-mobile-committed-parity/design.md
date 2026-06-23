## Context

Mobile's dashboard reached parity with the web redesign-v2 at commit `0f549f3`. After that, 8 web-only commits landed — almost entirely the **"Comprometido" rework** — plus two small polish items. The shared data layer (`@grana/dashboard`) changed **additively**, so mobile already compiles and shows correct numbers; only the **presentation** of four mobile components lags. This is implementation parity to an already-current spec, not a redesign.

What already landed and is consumed unchanged by mobile:
- `getCommittedOutlook` reworked to the "obligaciones pendientes" model. New per-currency fields: `overdue`, `topCard: CommittedItem[]`, `topRecurring: CommittedItem[]`. Field names `debt` / `recurringExpense` / `recurringIncome` kept; `debt`'s *meaning* tightened (started statements only — the inflation fix).
- `HeroAccountBalance.institutionName: string | null`.
- i18n keys `dashboard.committed.{total_label,card_label,card_hint,recurring_label,recurring_hint,view_cards,view_recurring,overdue,income_tile_title,income_tile_sub,net_surplus,net_deficit,empty}` — all present in `@grana/i18n-messages` (`es.json` / `en.json`).

Web reference files to port from:
- `apps/web/app/(app)/dashboard/_components/committed-section.tsx`
- `apps/web/app/(app)/dashboard/_components/committed-skeleton.tsx`
- `apps/web/app/(app)/dashboard/_components/spending-donut.tsx`
- `apps/web/app/(app)/dashboard/_components/accounts-card.tsx`
- `apps/web/lib/donut-amount.ts`

## Goals / Non-Goals

**Goals**
- Mobile `CommittedSection` renders the two-obligation-section model (Tarjeta a pagar + Recurrencias pendientes), each with subtotal (ARS + consistent USD) and top-3/4 movement detail, with **detail priority on Recurrencias**; overdue notice when `overdue > 0`; "Ya entra" + neto band preserved.
- `CommittedSkeleton` shape-matches the new card.
- `SpendingDonut` auto-scales the centre amount.
- `AccountsCard` shows `institutionName ?? name`.
- Cross-platform contract: same export names + public props as web; RN-idiomatic internals.

**Non-Goals**
- No changes to `@grana/dashboard`, `@grana/i18n-messages`, or `lib/dashboard/queries.ts`.
- No new money math (deuda already correct).
- "Compartido" strip stays web-only (out of scope, per spec).
- No web changes.

## Decisions

### 1. Re-port `CommittedSection` to the two-section model (replace tiles)
The current mobile card uses a `Tile` layout (`debt` / `recurring_expense` tiles + a USD strip at the bottom). Web replaced this with a `Section` sub-component: header (icon + label + hint + per-section ARS/USD subtotal) followed by the top movements list and a "ver más" link. Mobile SHALL mirror that structure with `View`/`Text`/`Pressable`.

- **USD treatment:** drop the bottom USD strip; show USD **per section** and on the total (consistent bimoneda), matching web. `showUsd = committedTotal(USD) > 0`.
- **Detail priority:** list movements for one section, prioritising Recurrencias — `items = topRecurring.length > 0 ? topRecurring (on recurrencias) : topCard (on tarjeta)`. Subtotals always show for both sections. (Mirrors web's `recurringHasItems` branch.)
- **Movement row:** `ddmm(date)` · description (truncate, fallback "—") · `MaskedAmount`. Reuse `MaskedAmount` / `MaskedAmountDisplay` already in mobile.
- **Overdue notice:** when `ars.overdue > 0`, a compact terracotta-soft banner with `AlertTriangle` + the `overdue` rich phrase. Reuse the existing `NetBand` regex-split trick (`<amount></amount>`) to inject the masked amount node — the `overdue` key uses the same single-tag shape.
- **Keep** the existing "Ya entra" tile + `NetBand`; only re-place them relative to the new sections.
- **Links:** `view_cards` → `router.push('/cards')`, `view_recurring` → `router.push('/transactions/recurring')` (expo-router), mirroring web hrefs.

### 2. Donut auto-scale: replicate the pure helper in mobile
`donutAmountFontSize(formatted, donutSize, maxPx)` in `apps/web/lib/donut-amount.ts` is pure presentational math (glyph-width estimate → largest fitting font-size). Mobile needs the same.

- **Decision:** replicate as `apps/mobile/lib/donut-amount.ts` (copy the function verbatim) rather than promoting it to a shared package now. Rationale: it's tiny, web-tuned for the same glyph set, and the workspace convention is cross-platform *naming* parity, not forced code sharing (`feedback_cross_platform_components`). Adding a shared-package surface for ~15 lines isn't justified yet.
- **Drift note:** leave a one-line comment in both copies pointing at each other so a future tweak updates both. If a third consumer appears, promote then.
- Mobile `SpendingDonut` SHALL compute the formatted total via `formatARS`/`formatUSD` from `@grana/i18n-messages` + `useShowCents()` (already used by `MaskedAmount` in mobile) and apply the resulting font size to the centre amount `Text`.

### 3. `CommittedSkeleton` reshape
Mirror web's new shape: total row (label + amount placeholders) + two obligation-section blocks (icon + label + subtotal placeholders, then two movement-row lines). Compose the existing `SkeletonBlock` primitive (`apps/mobile/components/ui/`) per the dashboard spec — do not hand-roll pulse animation. Keep `SWAP_MIN_HEIGHT` stable so the swap region doesn't jump.

### 4. `AccountsCard` institution name
Two-line change in spirit: render `account.institutionName ?? account.name` in the concentration callout and in each grid cell (mirrors web's `dominant.institutionName ?? dominant.name`). Pure label swap; no layout change.

## Risks / Trade-offs

- **Donut helper duplication** — accepted; mitigated by cross-reference comment. Alternative (shared package) rejected as premature.
- **i18n key drift** — low; keys verified present. Task includes a guard to confirm every `dashboard.committed.*` key web uses resolves on mobile before wiring copy.
- **Visual fidelity vs RN** — terracotta/navy icon backgrounds use the token mirror already in the file (`colors.navy`, inline `TERRACOTTA`); keep using the established mirror rather than inventing new hex.

## Migration Plan

Pure additive UI swap; no data or schema migration. Land all four files in one change; verify with `pnpm --filter mobile typecheck` and a Metro/dev render of `/dashboard` (committed card with: overdue debt, recurring income present/absent, empty state; donut with a long total; an account with vs without institution).

## Open Questions

- The newest web commits (`2bdd82d` / `5fe900b` / `9738751`) are fresh design iteration on the committed card. This change ports their **current** state; if web keeps iterating before mobile lands, re-diff `committed-section.tsx` at apply time.
