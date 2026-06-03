## Why

`/accounts/[id]` es la única ruta del módulo que sigue manejando filtros vía URL después de que `/transactions` migró a client + TanStack + state (change `migrate-transactions-to-client-queries`). Eso dejó dos consecuencias concretas:

1. El `page.tsx` es un async RSC que awaitea 5 queries antes del primer render (account detail, movements del historial completo, filter options, reembolsos, instituciones). Mientras eso resuelve, el `loading.tsx` del layout group tapa la pantalla entera — mismo problema de "header oculto durante el loading" que `/transactions` resolvió.
2. Para no romper este `/accounts/[id]` durante la migración de `/transactions`, se preservó el modo URL-driven en componentes compartidos. Eso dejó dead code en `lib/transactions/filters.ts` (`parseMovementFilters`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `resolveEmptyVariant`, `hasContentFilters`, `hasOtherContentFilters`, `hasSearch`, `movementMatchesText`, `buildClearedHref`), sus tests (~30), y los fallbacks "controller-opcional" en `MovementFilters` y `MovementList` que existen solo para esta ruta.

Migrar `/accounts/[id]` al mismo modelo cierra el ciclo: misma reference implementation que `/transactions`, mismo header pattern, misma mecánica de invalidación, y se elimina la última razón para que esos helpers existan. `/dashboard` y `/cards/[id]` se mantienen RSC (sin UX equivalente, sin filtros interactivos — el criterio "Route rendering model" de `AGENTS.md` los deja explícitamente como RSC).

## What Changes

- **BREAKING**: `/accounts/[id]` deja de aceptar filtros vía query string (`?month=`, `?from=`, `?to=`, `?currency=`, `?type=`, `?category=`, `?subcategory=`, `?account=`, `?q=`, `?amount_min=`, `?amount_max=`). Los filtros pasan a vivir en React state inicializado al default (mes corriente, sin currency, sin tipo, sin búsqueda). F5 limpia los filtros — comportamiento intencional, alineado con `/transactions`.
- `apps/web/app/(app)/accounts/[id]/page.tsx` se reduce a un shell async mínimo: auth guard, fetch ligero de la metadata de la cuenta para resolver los redirects terminales (`notFound` si no existe; `/cards/[id]` si `type==='credit'`), y monta `<AccountDetailShell accountId={id} />` (client).
- `AccountDetailHeader` pasa a client + `useQuery(getAccountDetail)`. El header (back link, avatar, nombre, badges, balances ARS/USD, botones edit/archive/reactivate/delete) está visible desde el primer paint con skeleton para los números mientras la query resuelve. El botón "Editar" queda disabled hasta que `account` + `institutions` (data del drawer) estén listos.
- Cada sección del shell (`PendingReimbursementsBlock`, `MovementFilters`, `MovementList`) consume queries client-side vía TanStack — reusando los containers ya construidos para `/transactions` cuando aplica, o nuevos cuando el scope difiere (movimientos scope cuenta vs. global).
- El running balance se computa client-side en el `MovementListContainer` cuando no hay filtros de contenido activos. Se mueve `computeRunningBalances` (`@grana/money-logic`) al lado cliente.
- **Account-scoped filters**: `MovementFilters` y `MovementList` se montan con `showAccount={false}` y `showAccountFilter={false}` (ya soportado, sin cambio).
- `EditAccountDrawerProvider` se monta adentro del shell client. `account` e `institutions` se obtienen via TanStack (cacheados con la misma key que el header los pide).
- Las server actions de mutation que afectan la lista (`createIncome`, `createExpense`, `updateTransaction`, `deleteTransaction`, etc.) ya llaman `revalidatePath` cross-route — sin cambios. El cliente invalida sus query keys de TanStack vía los helpers ya existentes en `lib/transactions/invalidation.ts`. Las actions de account (`archiveAccount`, `reactivateAccount`, `deleteAccount`, `updateAccount`, `addCurrencyToAccount`, `deactivateAccountCurrency`) suman invalidación de la query key del account detail.
- **Cleanup post-cutover**: una vez `/accounts/[id]` no consume más URL state, se elimina dead code de `lib/transactions/filters.ts` (`parseMovementFilters`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `buildClearedHref`, `resolveEmptyVariant`, `hasSearch`, `hasOtherContentFilters`, `hasContentFilters`, `movementMatchesText`) y sus tests asociados (~30 tests). El fallback URL-driven dentro de `MovementFilters` (los `if (!controller) setParamsUrl`) y los `Link` con `clearHref`/`addHref` dentro de `MovementList` se eliminan; los componentes quedan controller-only. Las constantes vivas (`SUBCATEGORY_NONE_MARKER`, `monthOf`, `shiftMonth`, `MovementFilters` type, `MovementTypeFilter`, `MovementCurrencyFilter`, `MOVEMENT_TYPE_KEYS`) se relocan a un módulo de utilidades de dominio (`lib/transactions/filters-state.ts` o `lib/transactions/month.ts`, alineado con la convención que ya usa el reducer de `/transactions`).

## Capabilities

### New Capabilities

(ninguna nueva — todo se expresa como modificación de specs existentes)

### Modified Capabilities

- `transactions`: el requirement "El listado de una cuenta muestra el saldo corriente por fila" no cambia su lógica funcional (los content filters siguen ocultando el saldo), pero su descripción menciona la URL como soporte ("filtros... en la URL"); se actualiza para neutralizar la mención y dejar la regla agnóstica del modelo de estado. Se agrega un requirement nuevo paralelo al de `/transactions`: el header de `/accounts/[id]` permanece visible durante carga/error del contenido y su acción primaria de edición está disabled hasta que la data del drawer esté lista. Se agrega además un requirement que codifica que los filtros de `/accounts/[id]` viven en React state, no en URL — coherente con `/transactions`.
- `route-loading-and-errors`: el requirement de "in-page chrome con `<Suspense>`" hoy lista `/dashboard` (y `/transactions` ya fue agregada). Se extiende para reconocer `/accounts/[id]` como caso de uso del patrón cliente + TanStack (misma mecánica que `/transactions`).
- `accounts`: el requirement "El usuario puede ver el detalle de una cuenta" se actualiza para reconocer que el shell de la ruta es client + TanStack (header visible desde el primer paint, secciones que fetchean independientemente), preservando los scenarios funcionales (detalle cash, detalle bank con institución, lista incluye transferencias entrantes, cuenta de otro usuario retorna 404).

## Impact

**Código afectado:**

- `apps/web/app/(app)/accounts/[id]/page.tsx` — rewrite (de ~165 líneas a ~20-30): auth guard + fetch ligero para `notFound`/`/cards/[id]` redirect + montaje del shell client
- `apps/web/app/(app)/accounts/[id]/_components/` — nuevos: `account-detail-shell.tsx`, `account-detail-content.tsx`, `use-account-detail-filters.ts` (o reuso del reducer/context compartido con `/transactions`)
- `apps/web/app/(app)/accounts/[id]/_components/account-detail-header.tsx` — cliente + `useQuery` sobre account detail; balances con skeleton mientras la query resuelve; botón "Editar" gated en `account+institutions`
- `apps/web/app/(app)/accounts/[id]/_components/edit-account-drawer.tsx` — sin cambios estructurales; el provider se monta adentro del shell client con sus props provenientes de queries cacheadas
- `apps/web/app/_actions/queries.ts` — agregar wrappers: `getAccountDetailAction(id)`, `getAccountMovementsAction(id)`, `getInstitutionsAction()` (los otros — filter options, pending reimbursements scoped al account, recurrence linked ids — ya existen o se agregan)
- `apps/web/lib/transactions/components/movement-filters.tsx` y `movement-list.tsx` — se eliminan los paths URL-fallback (`if (!controller) setParamsUrl`, `emptyState.clearHref`, `emptyState.addHref` como `Link`); los componentes quedan controller-only. Los containers (`MovementFiltersContainer`, `MovementListContainer`) se generalizan o se crean variantes para perspectiva cuenta (passing `accountId`, account-scoped queries)
- `apps/web/lib/transactions/filters.ts` — limpieza: eliminar `parseMovementFilters`, `buildFiltersClearedHref`, `buildSearchClearedHref`, `buildClearedHref`, `resolveEmptyVariant`, `hasSearch`, `hasOtherContentFilters`, `hasContentFilters`, `movementMatchesText`. Las constantes y types vivos se relocan a `lib/transactions/filters-state.ts` (o módulo afín). Imports actualizados en todos los call-sites: `_actions/queries.ts`, `queries.ts`, `query-keys.ts`, `dashboard/category-teaser-container.tsx`, `overview-container`
- `apps/web/lib/transactions/__tests__/filters.test.ts` — eliminado (los tests cubren los helpers eliminados; los tests del reducer ya están en su lugar)
- `apps/web/app/_actions/accounts.ts` — agregar `revalidateAfterAccountMutation()` helper o invocar el existing si lo cubre; las actions `archiveAccount`, `reactivateAccount`, `deleteAccount`, `updateAccount`, `addCurrencyToAccount`, `deactivateAccountCurrency` ya hacen `revalidatePath('/accounts', 'layout')` — verificar y reusar
- `apps/web/lib/accounts/queries.ts` — sin cambios funcionales; se confirma que `getAccountDetail` y `getInstitutions` son seguros de llamar desde server actions

**Dependencias:**

- `@tanstack/react-query` — ya está en el monorepo (montada en `(app)/layout.tsx` vía `AppQueryProvider`)
- No hay deps nuevas

**No afectado (intencional):**

- `/dashboard`, `/accounts` (lista), `/cards/[id]` y sub-rutas siguen siendo RSC
- `lib/accounts/queries.ts` y `lib/transactions/queries.ts` no cambian su superficie
- Las server actions de mutation siguen llamando `revalidatePath` server-side
- Rutas anidadas de account (`/accounts/[id]/edit`, `/accounts/new`) siguen como están — son páginas separadas

**Riesgos:**

- Regresión en empty states o clear actions: los empty variants (welcome, search, filter) y las acciones de limpiar pasan de URL-driven a state-driven. Plan: smoke test manual de cada variante + cada clear action.
- Cleanup de `lib/transactions/filters.ts` afecta a `dashboard/category-teaser-container` (consumer de `SUBCATEGORY_NONE_MARKER`) y otros. Plan: validar imports + correr typecheck antes de borrar nada.
- Running balance: hoy se computa server-side desde el historial ascendente completo. Pasarlo a cliente requiere que `MovementListContainer` o un hook auxiliar reciba el historial completo (no solo la página visible) y compute el balance ahí. Plan: reusar `computeRunningBalances` de `@grana/money-logic` directo en el cliente, lo cual ya es seguro (es pura). Una alternativa es exponer un endpoint `getAccountRunningBalancesAction(id)` que devuelva el snapshot necesario; se evalúa en design.md.
