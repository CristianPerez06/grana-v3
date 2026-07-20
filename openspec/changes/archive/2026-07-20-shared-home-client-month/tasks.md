## 1. Client month state

- [x] 1.1 Add `_components/shared-month-context.tsx` — port `dashboard-month-context.tsx`: `selected` in `useState`, `current` from props, `isCurrent`, `goPrev`/`goNext` → `undefined` at back-limit / current month; export `SharedMonthProvider` + `useSharedMonth`.
- [x] 1.2 Mount `SharedMonthProvider` in `(home)/layout.tsx`, current month derived server-side from the financial-timezone today, only in the active-household branch (setup/waiting states unchanged).

## 2. Persistent, gated header

- [x] 2.1 Add `_components/shared-home-header.tsx` (client): render the dashboard `MonthNavigator` wired to `useSharedMonth` + the register CTA; compute `isDisabled` from data/drawer like `dashboard-header.tsx` (`onPrev/onNext = undefined` while disabled).
- [x] 2.2 Render the header in `(home)/layout.tsx` outside the streamed body, keeping the existing `PageHeader` title + settings icon; remove the `<Link>`-based `monthNav` from `page.tsx`.

## 3. Split sections into container + client pairs

- [x] 3.1 Hero "Gasto del hogar": `hero-section-container.tsx` (RSC, seed current-month `getSharedAccruedMovements`, `<Suspense>` + in-card error) + `hero-section.tsx` (client, `useQuery(['shared','accrued',y,m])`, seeded when `isCurrent`); move breakdown/own-net-share derivations into the section or pure helpers.
- [x] 3.2 "Últimos movimientos": `recent-section-container.tsx` + `recent-section.tsx` (client, `useQuery(['shared','expenses',y,m])`, seeded when `isCurrent`); move the date-grouping derivation into the section/helper.
- [x] 3.3 "Qué se deben hoy": `debt-section.tsx` as a **pure RSC** container (fetches `getHouseholdDebt` + household/accounts it needs, renders directly, own in-card error) — NOT a client query, NOT month-keyed; preserve the settle CTA + "ver el detalle" link.
- [x] 3.4 "Lo que se viene": `outlook-section.tsx` as a **pure RSC** container (fetches `getHouseholdOutlook` + current debt for the sparkline anchor, renders directly, own error) — NOT a client query, NOT month-keyed; preserve the sparkline + empty state.
- [x] 3.5 Recompose `page.tsx` to render the four sections (+ recurrence teaser + pending settlements as-is), each behind its own `<Suspense>`; drop `searchParams`, `isValidMonth`, and the single `Promise.all`.

## 3b. Mutation refresh wiring

- [x] 3b.1 Add a `['shared']` prefix to `invalidateAfterMovementMutation` in `lib/transactions/invalidation.ts` so the month-scoped client sections refetch after a shared movement (debt/outlook RSC sections keep refreshing via the existing `router.refresh()`; settle flows unchanged).

## 4. Loading / error

- [x] 4.1 Give each container a shape-matched `<Suspense fallback>` skeleton; each client section an in-card skeleton (non-current month) + error/retry state.
- [x] 4.2 Slim `(home)/loading.tsx` to the initial chrome only (title + navigator placeholder), or remove it if it adds nothing over the header.

## 5. Verification

- [x] 5.1 Manual: month navigation does not change the URL or reload; each section streams its own skeleton then data; forcing one query to error leaves the others intact; boundary arrows disable at back-limit and current month; debt + outlook do NOT change when navigating months.
- [x] 5.2 `pnpm --filter web lint` and typecheck pass.
- [x] 5.3 `openspec validate shared-home-client-month --strict` passes.
