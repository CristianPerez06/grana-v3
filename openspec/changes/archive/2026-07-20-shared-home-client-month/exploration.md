# Exploration — `shared/(home)` → dashboard hybrid pattern

> Status: **exploration only** (not a proposal yet). Non-authoritative.
> Capability touched: `shared`. Reference patterns: `dashboard`, `route-loading-and-errors`, `web-data-access`.

## Context

The shared household home (`apps/web/app/(app)/shared/(home)`) should behave like the
dashboard: header chrome always visible (title / buttons / month picker) but disabled
until data is ready, month selection held in **client state** (not the URL), and each
section refetching **independently** when the month changes — no full route reload.

The dashboard is the reference implementation of this "hybrid RSC + client-state"
model and already ships every enabling piece we need.

## Current state

`(home)/page.tsx` is a **single monolithic async server component**:

- **Month lives in the URL** (`searchParams.m`); the navigator is two
  `<Link href={/shared?m=…}>` (page.tsx:188–206). Each month change is a full
  navigation → whole route re-renders. This is the core UX problem.
- **One `Promise.all` of 7 queries** (page.tsx:111–127) → the page blocks on the
  slowest query. Sections are **not** independent; a single route-level `loading.tsx`
  blocks everything together, with no per-section error isolation.
- **Month navigator lives inside the streamed body**, not in persistent chrome, and
  has **no disabled state** — plain links, live from first paint before data resolves.
- Title + register button already follow the always-visible pattern (in
  `(home)/layout.tsx`: `PageHeader` + self-disabling `RegisterMovementButton`). So the
  header is half-right — the **month navigator is the piece in the wrong place and
  never gated**.

Enabling infra already present (verified):

- `AppQueryProvider` (TanStack `QueryClientProvider`) wraps the whole `(app)` group →
  `useQuery` is available in shared.
- Every shared query is **client-agnostic** (`supabase: DbClient` first arg, no
  `server-only` / `next/*` imports) → callable from the browser client exactly like the
  dashboard sections call `@grana/dashboard` queries.

### How the dashboard does it (target)

```
layout.tsx (RSC)  ── derives today/current month, mounts providers, renders header
  │                  OUTSIDE the streamed body (chrome always painted)
  ├─ DashboardMonthProvider (client)  selected month in useState — NOT in URL,
  │     exposes { selected, current, isCurrent, goPrev?, goNext? }  (undefined at
  │     12-month boundary → navigator renders arrow disabled)
  ├─ DashboardHeader (client)  title + MonthNavigator + buttons;
  │     isDisabled = isLoading || !drawer  → arrows get onPrev/onNext = undefined,
  │     action button `disabled`. Chrome visible from first paint, only gated.
  └─ per section:
        *-section-container.tsx (RSC)  server-renders CURRENT month → initialData,
             own try/catch (in-card error), own <Suspense> skeleton
        *-section.tsx (client)  useQuery({
             queryKey: ['dashboard','balance-series', selected.year, selected.month],
             queryFn: () => getMonthBalanceSeries(createClient(), y, m),
             initialData: isCurrent ? initialData : undefined })
             → current month instant (seeded); other months fetch client-side with
               in-card skeleton + error/retry. Page never navigates.
```

## Key finding — not all four sections are month-scoped

The request lists four sections as "refetch on month change," but the current data
model only makes **two** of them month-scoped:

| Section                    | Query                                      | Month-scoped? |
|----------------------------|--------------------------------------------|:-------------:|
| **Gasto del hogar** (hero) | `getSharedAccruedMovements(supabase, month)` | ✅ yes |
| **Últimos movimientos**    | `getSharedExpenses(supabase, { month })`     | ✅ yes |
| **Qué se deben hoy** (debt)| `getHouseholdDebt(supabase)`                 | ❌ no — as-of-**today** |
| **Lo que se viene** (outlook)| `getHouseholdOutlook(supabase)`            | ❌ no — forward projection from today |

The current code even comments the navigator *"gobierna SOLO"* the hero. Making debt /
outlook move with the picker is a **semantic change** (debt "hoy" → "debt as of end of
month X"; projection needs a new anchor) and needs query params that don't exist yet.

**Decision (resolved):** make all four sections *independent* (own
boundary / skeleton / error), but only the two month-scoped ones *subscribe* to the
month context. **Debt + outlook stay today-anchored** — they do NOT follow the picker.
Their queries are unchanged and their `queryKey`s carry no month. If following the
picker is ever wanted, that's a separate query-layer change.

## Direction (proposed shape)

```
A. Month state → client context (kill the URL)
   - new _components/shared-month-context.tsx  (port of dashboard-month-context)
   - drop searchParams.m + isValidMonth + <Link> monthNav from page.tsx

B. Persistent, gated header
   - new _components/shared-home-header.tsx (client): MonthNavigator, arrows
     disabled (onPrev/onNext = undefined) until data/drawer resolve
   - (home)/layout.tsx: when isActive, wrap children in SharedMonthProvider + render
     header outside the body; setup/waiting states render no navigator

C. Split the monolith into independent sections
   (each = RSC container seeding current month + <Suspense> + own error,
    plus client section with useQuery keyed by selected)
   - Hero "Gasto del hogar"  → getSharedAccruedMovements  (month-scoped)
   - "Últimos movimientos"    → getSharedExpenses          (month-scoped)
   - "Qué se deben hoy"        → getHouseholdDebt           (NOT month-keyed)
   - "Lo que se viene"         → getHouseholdOutlook        (NOT month-keyed)
   - recurrence teaser + pending settlements stay as-is (own tiny Suspense optional)

D. Loading / error
   - replace whole-route blocking loading.tsx with per-section skeletons in each
     container's <Suspense fallback>, matching dashboard-content.tsx composition
   - each client section: in-card skeleton for non-current months + error/retry

E. Consistency
   - reuse the dashboard MonthNavigator (extract to a shared _components if we don't
     want a cross-route import) so both routes stay pixel-identical
   - month-scoped queryKeys include selected.year/month; initialData only when isCurrent
```

## Open questions

1. ~~**Debt + outlook month behavior**~~ — **RESOLVED: stay today-anchored.** Their
   queries are unchanged and their sections do not subscribe to the month context.
2. **MonthNavigator sharing** — import the dashboard component directly, or promote it
   to a route-group-neutral `_components` location? Both routes must stay identical.
3. **cuenta-corriente subroute** — does it need the same client-month treatment, or is
   this change scoped to `(home)` only?
4. **`loading.tsx` fate** — slim it to just the initial chrome, or delete it once each
   section owns its Suspense skeleton?
5. **"vas +$X este mes" anchor** — dashboard keeps a current-month figure alongside the
   browsed month (from seeded initialData). Does the shared hero want the same
   always-current secondary line, or does the hero fully follow the selected month?

## Next steps

- Resolve Q1 (debt/outlook) — it determines section count and query changes.
- Then promote to a full proposal (proposal.md + design.md + tasks.md + `shared`
  spec delta) under this change folder.
