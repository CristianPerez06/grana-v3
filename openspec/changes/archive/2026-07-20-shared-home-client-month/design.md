## Context

The Compartido home is today a single async server component (`(home)/page.tsx`) that reads the selected month from `searchParams.m` and awaits seven queries in one `Promise.all`. Month changes are `<Link href={/shared?m=…}>` navigations → full route reload, all sections blocked together by one route-level `loading.tsx`, and the navigator paints live before data resolves.

The dashboard is the reference implementation of the target "hybrid RSC + client-state" model and ships every enabling piece:

- `layout.tsx` (RSC) derives the current month server-side, mounts a client month-context provider, and renders the header **outside** the streamed body.
- A client month context holds `selected` in `useState` (not the URL), exposing `goPrev`/`goNext` that become `undefined` at boundaries.
- Each month-dependent section is a **container** (RSC, seeds current month as `initialData`, owns its `<Suspense>` + in-card error) plus a **section** (client, `useQuery` keyed by `selected`, seeded only when `isCurrent`).

Enabling infra already present and verified for shared: `AppQueryProvider` wraps the entire `(app)` group, and every shared query is client-agnostic (`supabase: DbClient` first arg, no `server-only`/`next/*`), so it is callable from the browser client via `createClient()`.

The `shared` spec already fixes the semantics — what each section shows, and that debt ("qué se deben hoy") and outlook ("lo que se viene") are today-anchored and do not follow the navigator. This change only alters the **delivery model**.

## Goals / Non-Goals

**Goals:**
- Selected month held in client state; month changes never navigate or reload the route.
- Header chrome (title, register CTA, settings, month navigator) visible from first paint, interactive controls disabled until ready.
- Four sections load and fail independently, each with its own skeleton + in-card error.
- Month-scoped sections (hero, últimos movimientos) refetch on month change; debt + outlook stay today-anchored and are never re-keyed by month.
- Visual output identical to today; parity with the dashboard's mechanics.

**Non-Goals:**
- No change to any shared query, the debt/settlement model, or the visual design.
- Debt/outlook do **not** become month-relative (would need new query params — out of scope).
- The `cuenta-corriente` subroute is untouched.
- Mobile is untouched (this is a web delivery-model refactor).

## Decisions

### D1. Month in a client context provider, not the URL

Introduce `_components/shared-month-context.tsx` — a direct port of `dashboard-month-context.tsx`: `selected` in `useState`, `current` passed from the server (layout), `isCurrent`, and `goPrev`/`goNext` that resolve to `undefined` at the back-limit / current month. Mounted in `(home)/layout.tsx`, but **only in the active-household branch** (setup / waiting-for-member states render no navigator).

- **Why:** URL-as-state forces a full RSC navigation per month; the dashboard already proved client state gives instant browsing. Porting (not sharing) matches the repo's cross-route component convention and keeps the dashboard context untouched.
- **Alternative considered:** promote `dashboard-month-context` to a shared location and import it in both routes. Rejected for now — the two providers may diverge (e.g. shared's back-limit), and a premature shared abstraction violates the "extract only when justified" convention. Revisit only if a third consumer appears.

### D2. Persistent, gated header in the layout

Add `_components/shared-home-header.tsx` (client) rendering the month navigator + register CTA, computing `isDisabled` from its data/drawer dependency exactly like `dashboard-header.tsx` (`onPrev/onNext = undefined` while disabled → navigator renders the arrow disabled). The layout keeps the existing `PageHeader` title + settings icon and now also mounts this header outside the streamed body.

- **Why:** satisfies "chrome always visible, disabled until ready" (`route-loading-and-errors` canonical rule) and matches the memory rule that the header is never replaced by a skeleton.

### D3. One container + one client section per section (4 sections)

Each section becomes its own unit behind a `<Suspense fallback={skeleton}>` in `page.tsx`, but the two **month-scoped** sections and the two **today-anchored** sections use different mechanics — driven by how each already refreshes after mutations (see D5).

| Section | Query | Mechanics | `queryKey` | Seeded |
|---|---|---|---|---|
| Gasto del hogar | `getSharedAccruedMovements(sb, ym)` | RSC container seeds current month → client section `useQuery` | `['shared','accrued', y, m]` | current month only (`isCurrent`) |
| Últimos movimientos | `getSharedExpenses(sb, { month })` | RSC container seeds current month → client section `useQuery` | `['shared','expenses', y, m]` | current month only |
| Qué se deben hoy | `getHouseholdDebt(sb)` | **pure RSC** container (renders directly, own error) — no client query | — | — |
| Lo que se viene | `getHouseholdOutlook(sb)` (+ current debt for the sparkline anchor) | **pure RSC** container — no client query | — | — |

The pure derivations currently inline in `page.tsx` (breakdown slices, own-net-share, recent grouping by date) move into the client sections or small pure helpers — they already depend only on query output. Recurrence teaser + pending settlements stay as-is (optionally each behind its own tiny `<Suspense>`).

- **Why month-scoped sections are client:** they must refetch when the month changes without navigating — only a client query keyed by `selected` can.
- **Why debt/outlook are pure RSC (not client `useQuery`, revised from the first draft):** they never change with the month, and they already refresh through `router.refresh()` (see D5). Keeping them RSC means the settle flow needs **zero changes**; making them client queries would silently break settle refresh (`router.refresh()` does not touch the TanStack cache) and force new invalidation wiring into the settlement components — a stated non-goal. Independence (own Suspense + in-card error) is fully satisfied by the RSC container alone.

### D5. Mutation refresh — one line of invalidation, no settlement-flow changes

`movement-form.tsx` already fires **both** `invalidateAfterMovementMutation(queryClient)` and `router.refresh()` on success. The settle flows (`settle-form.tsx`, `pending-settlement-card.tsx`) fire `router.refresh()` + server-action `revalidatePath('/shared')`.

- Month-scoped client sections refetch after a shared expense by adding a single `['shared']` prefix to `invalidateAfterMovementMutation` (mirrors the existing `['dashboard']` prefix there).
- Debt/outlook RSC sections refresh via the `router.refresh()` these flows already call — unchanged.

- **Why:** `router.refresh()` re-renders RSC but not client queries; `invalidateQueries` refetches client queries but not RSC. The hybrid uses each where it applies, matching the dashboard's own split.

### D4. Household gating stays where it is

The setup / waiting-for-member / active branching stays driven by `getHousehold` in the layout (which already computes `isActive`). Provider + header + section grid render only when active.

### Resolved smaller questions (were open in exploration)

- **MonthNavigator sharing:** reuse the existing dashboard `MonthNavigator` presentational component by importing it; it is already pure (`year/month/onPrev/onNext`). No extraction unless a third consumer appears (D1 rationale). *Default; low-cost to revisit.*
- **`cuenta-corriente`:** out of scope for this change.
- **`loading.tsx` fate:** slim it to the initial chrome only (title + navigator placeholder), since each section now owns its Suspense skeleton. Delete only if it adds nothing over the header.
- **"vas +$X este mes" anchor:** the shared hero has no dashboard-style always-current secondary line, so no equivalent is needed — the hero fully follows the selected month. (If one is later wanted, seed it from the current-month `initialData` like the dashboard does.)

## Risks / Trade-offs

- **Derivation logic drifts when moved out of `page.tsx`** → keep each moved derivation pure and covered by the existing section output; port verbatim, no behavior change.
- **Double fetch of the current month (server seed + client mount)** → guard with `initialData: isCurrent ? seed : undefined` + a `staleTime` (dashboard uses `60_000`) so the seeded current month does not immediately refetch.
- **Auth/RLS on browser-side reads** → same posture as the dashboard client sections; RLS is the authorization boundary and queries already run client-side there. No new surface.
- **Header disabled-state fltold wrong (controls stuck disabled)** → derive `isDisabled` from the same signals the dashboard header uses (loading + drawer presence); reuse its pattern rather than inventing one.

## Migration Plan

Pure web refactor, no data/schema/API migration. Ship behind normal review; revert is a straight git revert of the route files. Manual verification: month navigation does not change the URL or reload; each section shows its own skeleton then data; forcing one query to error leaves the others intact; back/forward boundary arrows disable correctly; debt/outlook do not change when navigating months.

## Open Questions

None blocking. All exploration questions are resolved above (debt/outlook today-anchored per prior decision; navigator reuse, cuenta-corriente scope, loading.tsx, and the current-month line settled with defaults).
