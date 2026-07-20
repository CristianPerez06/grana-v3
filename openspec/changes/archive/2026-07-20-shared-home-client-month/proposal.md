## Why

The Compartido home (`apps/web/app/(app)/shared/(home)`) holds the selected month in the URL (`?m=YYYY-MM`) and renders as a single monolithic server component that awaits every section in one `Promise.all`. Changing the month triggers a full route navigation (whole page reload, all sections block together), and the month navigator paints live before any data resolves. The dashboard already solves this with a hybrid RSC + client-state pattern; the shared home should match it so month browsing is instant and each section streams and fails independently.

## What Changes

- Move the selected month from the URL (`searchParams.m`) into **client state** via a `SharedMonthProvider` (port of `dashboard-month-context`); changing the month no longer navigates or reloads the route.
- Make the header chrome (household title, register CTA, settings icon, **month navigator**) **always visible from first paint** but with interactive controls **disabled until data/drawer resolve** — the navigator arrows in particular are no longer live-before-ready plain `<Link>`s.
- Split the monolithic page into **independent per-section units**: each section is an RSC container that seeds the current month and owns its `<Suspense>` skeleton + in-card error, plus a client section that reads via `useQuery`.
- Only the two month-scoped sections re-key/refetch on month change: **Gasto del hogar** (`getSharedAccruedMovements`) and **Últimos movimientos** (`getSharedExpenses`). **Qué se deben hoy** (`getHouseholdDebt`) and **Lo que se viene** (`getHouseholdOutlook`) stay **today-anchored** — independent boundaries, never keyed by the selected month.
- Replace the whole-route blocking `loading.tsx` with per-section skeletons in each container's `<Suspense fallback>`.

No changes to the shared data queries, the debt/settlement model, or the visual design. This is a delivery-model refactor of an existing screen.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared`: adds a requirement codifying the home's **delivery model** — client-state month selection (no reload on change), always-visible-but-disabled header chrome until ready, and independent per-section loading/error with the month-scoped vs today-anchored fetch split. The existing content/semantics of "El usuario puede ver el dashboard del hogar" (what each section shows, and that debt/projection are today-anchored) are unchanged.

## Impact

- **Code (web only):**
  - `apps/web/app/(app)/shared/(home)/page.tsx` — decomposed; loses `searchParams`, `isValidMonth`, and the `<Link>`-based month navigator.
  - `apps/web/app/(app)/shared/(home)/layout.tsx` — mounts `SharedMonthProvider` + persistent header (active-household branch only).
  - New `_components/`: `shared-month-context.tsx`, `shared-home-header.tsx`, and per-section container/section pairs for hero, últimos movimientos, debt, outlook.
  - `apps/web/app/(app)/shared/(home)/loading.tsx` — slimmed to initial chrome (or removed) once sections own their skeletons.
- **Infra already present (no change):** `AppQueryProvider` wraps the `(app)` group; all shared queries are client-agnostic (`supabase: DbClient`, no `server-only`/`next/*`), so they are callable from the browser client.
- **Reference patterns:** `dashboard` (target implementation), `route-loading-and-errors` (always-visible chrome, per-section boundaries), `web-data-access` (client-query read slice).
- **Out of scope:** the `cuenta-corriente` subroute; any change making debt/outlook follow the month picker (would require new query parameters).
