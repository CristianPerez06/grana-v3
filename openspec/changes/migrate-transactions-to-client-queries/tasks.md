## 1. Setup y dependencias

- [x] 1.1 Verificar si `@tanstack/react-query` ya está en el monorepo; si no, agregarla a `apps/web` con `pnpm add @tanstack/react-query` (decidir entre raíz vs. workspace local según convención del repo)
- [x] 1.2 Agregar `@tanstack/react-query-devtools` como dev dep en `apps/web`
- [x] 1.3 Verificar versión React compatible con TanStack Query v5 (RN 0.81 pinea React 19.1.0 → confirmar TanStack soporta)

## 2. Capa de queries reusable (server actions wrappers)

- [x] 2.1 Crear `apps/web/app/_actions/queries.ts` con `'use server'` y wrappers para cada query usada por `/transactions`:
  - `getMovementsPageAction(input)`
  - `getMovementFilterOptionsAction(input)`
  - `getMonthCategoryBreakdownAction(month)`
  - `getMonthSubcategoryBreakdownAction(month, categoryId)`
  - `getMonthIncomeBreakdownAction(month)`
  - `hasUsdActivityInMonthAction(month)`
  - `hasAnyTransactionAction()`
  - `getPendingReimbursementsAction()`
  - `getPendingRecurrenceInstancesAction()`
  - `getTopRecurrenceSuggestionAction()`
  - `getRecurrenceLinkedTransactionIdsAction(txIds)`
  - `getAccountsAction()`
  - `getAllCategoriesAction()`
  - `getHouseholdAction()`
- [x] 2.2 Cada action delega a la función existente en `lib/.../queries.ts` sin lógica nueva (solo el `'use server'` boundary)
- [x] 2.3 Confirmar que cada action incluye guard de auth si la función subyacente no lo hace (mirar precedente de `_actions/transactions.ts`)

## 3. Provider y configuración global de TanStack

- [x] 3.1 Crear `apps/web/app/(app)/transactions/_components/transactions-query-provider.tsx`: client component que crea `QueryClient` con `staleTime` defaults configurables vía `defaultOptions.queries.staleTime` (default 0)
- [x] 3.2 Configurar `staleTime` por familia de queryKey via `setQueryDefaults`:
  - `['accounts','list']`: 5min
  - `['categories','tree']`: 15min
  - `['household','detail']`: 15min
  - `['transactions','filter-options']`: 2min
  - `['transactions','has-any']`: `Infinity`
  - `['recurrences','top-suggestion']`: 5min
  - Resto: 0 (default)
- [x] 3.3 Decidir y documentar comportamiento de `refetchOnWindowFocus` (sugerencia: `true` para queries con staleTime 0, `false` para las cacheadas largo)

## 4. Estado de filtros centralizado

- [x] 4.1 Crear `apps/web/app/(app)/transactions/_components/filters-context.tsx`: define `Filters` type, `FiltersAction` union, `filtersReducer` puro, `FiltersContext`, `FiltersProvider`, hook `useTransactionsFilters()` (el reducer puro + tipos viven en `lib/transactions/filters-state.ts` para ser testeables sin React)
- [x] 4.2 `Filters` cubre: `month`, `customRange` (con prioridad sobre month), `currency` (ARS/USD), `type` (income/expense/transfer/adjustment/exchange/null), `accountId`, `categoryId`, `subcategoryId`, `query` (search), `overviewMode` (egresos/ingresos), `limit`
- [x] 4.3 `FiltersAction` cubre: `setMonth(string)`, `prevMonth()`, `nextMonth()`, `setCurrency(c)`, `setOverviewMode(m)`, `setType(t)`, `setCategory(id)`, `setSubcategory(id)`, `setAccount(id)`, `setQuery(q)`, `clearSearch()`, `clearFilters()` (no toca search ni navegación), `clearAll()`, `setLimit(n)`, `incrementLimit()`, `reset()`
- [x] 4.4 Default initial state: mes actual via `getTodayAR() + formatDateISO`, currency ARS, overview egresos, resto vacío
- [x] 4.5 Tests unitarios del reducer (cubrir cada acción y casos edge: clear con search activa, navegación con customRange activo, etc.) — 22 tests verdes

## 5. Header con drawer readiness

- [x] 5.1 Crear `apps/web/app/(app)/transactions/_components/transactions-header.tsx`: client component que usa `useQueries` para `accounts`, `categories`, `household`
- [x] 5.2 Computar `drawerReady` como `every(q.data !== undefined)`. Si una query falla, el botón se queda disabled — el fallback degraded se hace via la behavior actual del botón sin drawer context (cae al `<Link>` cuando no hay provider). El modo degraded con toast queda para un follow-up cuando exista sistema de toasts.
- [x] 5.3 Renderizar `<PageHeader>` con título (i18n `transactions.title`), descriptionExtras (link a recurrencias, igual que hoy), y `actions={<RegisterMovementButton disabled={!drawerReady} />}`
- [x] 5.4 Modificar `RegisterMovementButton` (`apps/web/lib/transactions/components/register-movement-button.tsx`): aceptar prop opcional `disabled` (backwards-compatible — los callers existentes no la pasan); cuando es true renderiza disabled visual sin onClick; cuando es false/undefined preserva comportamiento existente (button con drawer context, Link sin él)

## 6. Shell de la ruta

- [x] 6.1 Reducir `apps/web/app/(app)/transactions/page.tsx` a un shell async (auth guard server-side + `<TransactionsShell />`) — de ~420 líneas a ~20. Ruta paralela `/transactions/preview` eliminada.
- [x] 6.2 Crear `apps/web/app/(app)/transactions/_components/transactions-shell.tsx`: client component (`'use client'`) que envuelve todo en `<TransactionsQueryProvider>` → `<FiltersProvider>` → `<TransactionsContent>`
- [x] 6.3 Crear `apps/web/app/(app)/transactions/_components/transactions-content.tsx`: client component que renderiza header + secciones + drawer provider + FAB en el orden visual actual (header + FAB ya; secciones llegan en grupo 7). Drawer provider wrapped vía `<MovementDrawerLoader>` que resuelve sus 3 queries con TanStack y monta el provider cuando están listas

## 7. Migración sección por sección a client + useQuery

- [x] 7.1 `RecurrenceSuggestionBanner`: wrapper `RecurrenceSuggestionBannerContainer` con `useQuery`; render existing component si hay sugestión (fail silently)
- [x] 7.2 `PendingRecurrencesBlock`: wrapper `PendingRecurrencesBlockContainer` con `useQueries` para pending-instances + accounts; deriva `availableByAccount` desde cache
- [x] 7.3 `CategorySpendingOverview`: container `CategorySpendingOverviewContainer` con `useQueries` de breakdowns expense/income/subcategory + hasUsdActivity; convierte filtros del context a controller con dispatchers (`prevMonth`, `nextMonth`, `setCurrency`, `setOverviewMode`, `setCategory/Subcategory`); componente existente refactoreado para aceptar prop `controller?` opcional sin romper callers legacy
- [x] 7.4 `PendingReimbursementsBlock`: wrapper `PendingReimbursementsBlockContainer` con `useQuery`; computa `todayISO` client-side
- [x] 7.5 `MovementFilters`: container `MovementFiltersContainer` con `useQuery` de filter-options; controller con dispatchers para query/type/account/category/subcategory/currency/amountMin/amountMax/month + clearAll; componente refactoreado para aceptar `controller?` opcional, fallback URL preservado para /accounts/[id]
- [x] 7.6 `MovementList`: container `MovementListContainer` con `useQueries` para page + linked-recurrence-ids + `useQuery` para has-any (staleTime Infinity); empty state computa variant via `hasActiveContentFilters/hasActiveSearch`; callbacks `onClear`/`onAdd` reemplazan los hrefs (el componente sigue soportando hrefs para callers legacy); load-more incrementa limit via reducer
- [x] 7.7 `MovementDrawerProvider`: montado vía `MovementDrawerLoader` adentro de `<TransactionsContent>`; resuelve `accounts/categories/household` con `useQueries` y monta el provider cuando todas están listas
- [x] 7.8 `QuickAddFab`: sin cambios; `pb-24 sm:pb-0` preservado en `TransactionsContent`

## 8. Helpers de invalidación (cliente)

- [x] 8.1 Crear `apps/web/lib/transactions/invalidation.ts` con las 4 funciones definidas en el design:
  - `invalidateAfterMovementMutation(qc)`
  - `invalidateAfterRecurrenceInstanceMutation(qc, { confirmed })`
  - `invalidateAfterReimbursementMutation(qc)`
  - `invalidateAfterSuggestionMutation(qc)`
- [x] 8.2 Agregar comentario marcador en el archivo apuntando a `app/_actions/_helpers.ts` (group 9) para mantener sync entre invalidations cliente y `revalidatePath` server
- [x] 8.3 Agregar helpers + `useQueryClient` a los call-sites: `recurrence-suggestion-banner.tsx`, `pending-recurrences-block.tsx`, `pending-reimbursements-block.tsx`, `movement-form.tsx`, `tx-actions-menu.tsx` (delete). Helpers se llaman **antes** del `router.refresh()` existente — TanStack invalida cache del cliente, `router.refresh()` se queda por ahora para invalidar RSC de rutas legacy (sigue siendo no-op en la ruta cliente nueva). Group 9 reemplaza `router.refresh()` con `revalidatePath` server-side.
- [x] 8.4 Mover `QueryClientProvider` al `(app)/layout.tsx` via `AppQueryProvider` para que componentes con mutations puedan llamar `useQueryClient()` sin saber si el host route opta por TanStack. `TransactionsQueryProvider` eliminado (redundante).

## 9. Helpers de `revalidatePath` (server)

- [x] 9.1 Crear `apps/web/app/_actions/_helpers.ts` con las 4 funciones; cada una llama `revalidatePath('/<segment>', 'layout')` para invalidar segmento + descendientes en una pasada (cubre `/accounts/[id]`, `/transactions/[id]`, `/cards/[id]/...`). Cubre `/dashboard` siempre — gap del legacy donde mutations no la invalidaban
- [x] 9.2 13 server actions en `app/_actions/transactions.ts` migradas a `revalidateAfterMovementMutation()` (bulk via Python script). Removidos los params `accountId`/`destinationAccountId` que solo se usaban para per-account revalidatePath (ahora cubierto por `layout` flag); callers actualizados (`tx-actions-menu`, `transaction-actions`, `movement-form`)
- [x] 9.3 `app/_actions/recurrences.ts`: 10 actions migradas. `confirmRecurrenceInstance` llama `revalidateAfterMovementMutation()` + `revalidateAfterRecurrenceMutation()` (crea un movimiento). `acceptRecurrenceSuggestion` llama recurrence + suggestion. `dismissRecurrenceSuggestion` solo suggestion. Resto (rules) usa solo recurrence
- [x] 9.4 `app/_actions/reimbursements.ts`: helper local `revalidateReimbursementPaths()` eliminado; 2 callsites usan `revalidateAfterReimbursementMutation()` directo

## 10. Eliminación de URL builders y parsers

- [x] 10.1 Scope ajustado al audit real: `/accounts/[id]` sigue siendo URL-driven (`parseMovementFilters`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `hasContentFilters`, `resolveEmptyVariant`, `movementMatchesText`) y consume la mayoría de `filters.ts`. Los exports genuinamente muertos post-cutover: `parseMovementLimit` y `buildMovementLimitHref`. Ambos eliminados. `monthOf`, `shiftMonth`, `SUBCATEGORY_NONE_MARKER`, `MovementFilters` type, constantes de limit, `MovementCurrencyFilter`/`MovementTypeFilter`/`MOVEMENT_TYPE_KEYS` permanecen porque son consumidos por `/accounts/[id]`, la query subyacente o el reducer
- [x] 10.2 Tests dead-code eliminados: bloques `parseMovementLimit` y `buildMovementLimitHref` (5 tests). El resto del file sigue cubriendo helpers vivos (`parseMovementFilters`, `resolveEmptyVariant`, etc.) usados por `/accounts/[id]`
- [x] 10.3 Audit cerrado: 8 imports de `lib/transactions/filters` sobreviven (todos válidos — `/accounts/[id]`, `dashboard/category-teaser-container`, `overview-container` para `SUBCATEGORY_NONE_MARKER`, `_actions/queries`, `queries.ts`, `query-keys`, `movement-filters` component fallback URL para `/accounts/[id]`, `filters.test.ts`). Cleanup completo de `filters.ts` queda para cuando `/accounts/[id]` se migre a client (follow-up change)

## 11. Verificación cross-route y smoke test manual

- [x] 11.1 Verificar que ningún componente fuera de `/transactions` linkea al list view con query params (grep confirmó al diseño; revalidar post-implementación) — validado durante desarrollo
- [x] 11.2 Smoke test: navegar a `/transactions`, verificar header visible desde el primer paint con botón disabled — validado por usuario
- [x] 11.3 Smoke test: verificar que el botón se habilita en cuanto las tres queries del drawer terminan — validado por usuario
- [x] 11.4 Smoke test: cambiar mes, verificar que la URL NO cambia y el contenido se actualiza — validado por usuario
- [x] 11.5 Smoke test: aplicar filtro (categoría, cuenta, currency, tipo), verificar chips removibles + reconsulta — validado por usuario
- [x] 11.6 Smoke test: F5 limpia todos los filtros y vuelve al mes corriente — validado por usuario
- [x] 11.7 Smoke test: empty state variants — validado por usuario
- [x] 11.8 Smoke test: drill-in de categoría → subcategoría → back — validado por usuario
- [x] 11.9 Smoke test: crear un movimiento desde el drawer → verificar que la lista, breakdowns, balances se actualizan inmediatamente — validado por usuario
- [x] 11.10 Smoke test cross-route — validado por usuario
- [x] 11.11 Smoke test: confirmar una recurrencia pendiente — validado por usuario
- [x] 11.12 Smoke test: marcar reembolso como recibido y como cancelado — validado por usuario
- [x] 11.13 Smoke test: aceptar y descartar sugerencia de recurrencia — validado por usuario

## 12. Lint, typecheck, tests

- [x] 12.1 `pnpm typecheck` en `apps/web` sin errores
- [x] 12.2 `pnpm lint` en `apps/web` sin errores ni warnings
- [x] 12.3 Tests unitarios del reducer pasan (22 tests)
- [x] 12.4 Tests existentes pasan (343 tests totales — 5 menos que el inicio porque se borraron tests de `parseMovementLimit`/`buildMovementLimitHref` dead code)
- [x] 12.5 Cleanup: imports unused eliminados; archivos `.legacy.tsx` nunca se crearon (el plan paralelo se hizo via `/transactions/preview` que ya fue borrado en el cutover)

## 13. Documentación y archivo

- [x] 13.1 `AGENTS.md` (raíz, monorepo-level) actualizado en la sección "Conventions" con sub-sección "Route rendering model": codifica el criterio (interactividad de cliente → TanStack + state; read-only → RSC + Suspense) y refiere a `/transactions` como reference implementation
- [ ] 13.2 PR — usuario decidió no abrir PR formal (ver memoria: "nadie va a revisar el PR"); merge directo a main lo hace el usuario
- [ ] 13.3 Archivar el change con `/opsx:archive` — post-merge, lo dispara el usuario
