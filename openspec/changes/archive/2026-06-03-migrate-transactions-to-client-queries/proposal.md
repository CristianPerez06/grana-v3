## Why

La ruta `/transactions` hoy hace todo su fetching en un único `page.tsx` server component que awaitea 8+ queries en serie/paralelo antes de renderizar nada. Mientras eso resuelve, el `loading.tsx` del layout group tapa la pantalla entera — incluido el header. El usuario ve un spinner full-screen en vez del chrome de la ruta, contrariando el patrón "in-page chrome" que `/dashboard` y `/accounts` ya siguen (definido como MAY en el spec `route-loading-and-errors`).

Resolver solo eso sería un cambio chico. Pero `/transactions` tiene tres problemas subyacentes que comparten causa raíz — el modelo "todo se fetchea server-side y los filtros viven en la URL":

1. **Filtros como query strings** generan helpers de serialización (`buildFiltersClearedHref`, `buildSearchClearedHref`, `buildMovementLimitHref`, `parseMovementFilters`) y obligan a cada toggle a navegar para mutar state.
2. **La invalidación se hace con `router.refresh()`** después de cada mutation — un re-render full server-side cada vez, sin granularidad.
3. **Mobile no puede replicar este patrón** porque React Native no tiene URL params; cuando aterrice la app mobile, toda la capa de filter management se reescribe.

Migrar `/transactions` a client components + TanStack Query + React state resuelve los tres en un solo cambio, sin tocar `/dashboard`, `/accounts` ni `/cards/[id]` (que siguen siendo RSC y funcionan bien — no tienen UX interactivo equivalente).

## What Changes

- **BREAKING**: `/transactions` deja de aceptar filtros vía query string (`?month=`, `?currency=`, `?category=`, `?q=`, `?type=`, `?overview=`, `?subcategory=`, `?limit=`, etc.). Los filtros pasan a vivir en React state inicializado al default (mes corriente, ARS, egresos, sin filtros adicionales). F5 limpia los filtros — comportamiento intencional.
- **BREAKING**: Se elimina `lib/transactions/filters.ts` (los builders/parsers de hrefs ya no se necesitan). Las constantes semánticas que sobreviven (`SUBCATEGORY_NONE_MARKER`, `UNCATEGORIZED_ID`, `monthOf`, `shiftMonth`) se relocan a un módulo de utilidades de dominio.
- `apps/web/app/(app)/transactions/page.tsx` se reduce a un shell sync que monta `<TransactionsShell>` (client). El shell contiene `<TransactionsHeader>` + `<TransactionsContent>`.
- Cada sección (`RecurrenceSuggestionBanner`, `PendingRecurrencesBlock`, `CategorySpendingOverview`, `PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) pasa a ser un client component con su propio `useQuery`.
- El header está visible desde el primer paint. Su acción primaria (`RegisterMovementButton`) está **disabled** mientras `accounts`, `categories` y `household` (lo que el drawer necesita) no estén listas; se habilita cuando las tres resuelven.
- Las server actions de mutation (`createIncome`, `createExpense`, `updateTransaction`, `deleteTransaction`, `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `confirmReimbursement`, `cancelReimbursement`, `acceptRecurrenceSuggestion`, `dismissRecurrenceSuggestion`, etc.) llaman `revalidatePath` server-side para mantener fresco el cache RSC de las otras rutas (`/dashboard`, `/accounts`, `/cards`). El cliente invalida sus query keys de TanStack al `onSuccess`.
- Los componentes que hoy hacen `router.refresh()` post-mutation (`pending-reimbursements-block`, `pending-recurrences-block`, `recurrence-suggestion-banner`, `movement-form`) cambian a invalidar query keys via helpers semánticos (`invalidateAfterMovementMutation`, `invalidateAfterRecurrenceInstanceMutation`, etc.).
- Se introduce `<TransactionsQueryProvider>` (un wrapper de `QueryClientProvider` configurado con los `staleTime` apropiados por key family) montado en el shell de la ruta.

## Capabilities

### New Capabilities

(ninguna nueva — todo se expresa como modificación de specs existentes)

### Modified Capabilities

- `transactions`: el módulo global de movimientos cambia su contrato de presentación. Los requirements de "búsqueda y filtros", "destaca movimientos que requieren revisión", "listado global distingue motivo de vacío" y "acceso rápido flotante para registrar un movimiento" siguen siendo los mismos a nivel funcional, pero su comportamiento de estado deja de ser URL-driven y pasa a ser state-driven. Se agrega un requirement nuevo: el header de la ruta permanece visible durante carga/error del contenido, con su acción primaria disabled hasta que la data necesaria para abrir el drawer esté lista. Se elimina (o se reescribe) cualquier requirement que asuma URL-state como source of truth.
- `route-loading-and-errors`: el requirement #5 (in-page chrome con `<Suspense>`) hoy lista a `/dashboard` como primer caso de uso. Se agrega `/transactions` como segundo caso de uso, con la variante de que su implementación usa client components + TanStack Query (no `<Suspense>` server-side) — el principio es el mismo (header visible, button disabled durante loading, error in-page), pero la mecánica difiere por la naturaleza interactiva de la ruta.

## Impact

**Código afectado:**

- `apps/web/app/(app)/transactions/page.tsx` — rewrite (de ~420 líneas a ~30)
- `apps/web/app/(app)/transactions/_components/` — nuevos: `transactions-shell.tsx`, `transactions-header.tsx`, `transactions-content.tsx`, `transactions-query-provider.tsx`, `use-transactions-filters.ts`, `use-drawer-readiness.ts`
- `apps/web/lib/transactions/components/` — `movement-filters.tsx`, `movement-list.tsx` (más sus skeletons), `category-spending-overview.tsx`, `pending-reimbursements-block.tsx` y `pending-recurrences-block.tsx` se vuelven puramente client + consumen filtros via hook/context en vez de props server-resolved
- `apps/web/lib/recurrences/components/recurrence-suggestion-banner.tsx` — pasa a client + `useQuery`
- `apps/web/lib/transactions/filters.ts` — **eliminado** (URL builders/parsers ya no aplican); helpers semánticos (`monthOf`, `shiftMonth`, constantes) se mueven a `lib/transactions/month.ts` o similar
- `apps/web/lib/transactions/queries.ts` — sin cambios funcionales, pero se exponen wrappers para llamarlas desde el cliente (server actions del shape `getXxxAction`)
- `apps/web/lib/transactions/invalidation.ts` — **nuevo**: 4 helpers de invalidación (`invalidateAfterMovementMutation`, `invalidateAfterRecurrenceInstanceMutation`, `invalidateAfterReimbursementMutation`, `invalidateAfterSuggestionMutation`)
- `apps/web/app/_actions/_helpers.ts` (nuevo o existente) — helpers de `revalidatePath` cross-route llamados desde server actions
- `apps/web/app/_actions/transactions.ts`, `recurrences.ts`, `reimbursements.ts` — agregar `revalidatePath` a cada mutation
- `apps/web/lib/transactions/__tests__/filters.test.ts` — **eliminado** (no hay más URL builders que testear)
- Componentes/rutas que linkean a `/transactions` con query strings: `dashboard/_components/category-teaser-container.tsx` (link "ver todos") — ya linkea sin query, OK. Auditar el resto.

**Dependencias nuevas:**

- `@tanstack/react-query` (probablemente nueva en el monorepo — confirmar; si ya está en `apps/mobile` por reuse, importar de allí o de root)
- `@tanstack/react-query-devtools` (dev-only, opcional)

**No afectado (intencional):**

- `/dashboard`, `/accounts`, `/cards/[id]` y sus sub-rutas siguen siendo RSC. No tienen UX interactivo equivalente a `/transactions` y migrar sería refactor sin beneficio claro (ver análisis en design.md).
- Las server actions de mutation (creación/edición/eliminación) NO cambian su signature. Solo se les agrega `revalidatePath` al final.
- Los componentes `transactions/new/page.tsx`, `transactions/[txId]/page.tsx`, `transactions/recurring/*` siguen como están — son páginas de detalle/creación, no la list view.
- `lib/transactions/queries.ts` no cambia su superficie; solo se asegura de ser invocable desde server actions con el shape que TanStack espera (las queries hoy son server-only y eso sigue siendo correcto — el cliente las llama via server actions, no fetch directo).

**Riesgos:**

- Regresión funcional en filtros (no haber portado un caso edge del empty-state variants, del clear-search, del month nav, del drill-down de subcategoría).
- Inconsistencia momentánea cross-route: si se olvida un `revalidatePath` en una mutation, el `/dashboard` puede mostrar balance stale después de crear un movimiento. Mitigación: helper único `revalidateAfterMovementMutation()` llamado en todas las acciones de tx.
- Bundle size de `/transactions` crece. Aceptable; la ruta ya es la más pesada del app.
