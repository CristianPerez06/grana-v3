# Proposal: accounts-direct-reads

## Why

`/accounts/[id]` es el peor remanente del rollout de direct reads tras el piloto `/transactions` (archivado 2026-06-11): el mount dispara ~6 server actions como `queryFn` de TanStack Query (account detail, movimientos ascendentes, filter options, pending reimbursements, linked recurrence ids, institutions), y React las **serializa** por cliente — el tiempo de carga es la suma de los roundtrips, no el máximo. El patrón canónico ya existe (spec `web-data-access`), las query functions ya son client-agnósticas y la validación local de sesión ya está en el proxy: la ruta solo tiene que adoptar el patrón.

## What Changes

- Los containers client de `/accounts/[id]` (`account-detail-content`, `account-detail-header`, `movement-list-account-container`, `movement-filters-account-container`, `pending-reimbursements-account-container`, `edit-account-drawer-loader`) cambian sus `queryFn` de server actions a las query functions directas con el browser client (`createClient()`), igual que `/transactions`.
- Se **eliminan** los 6 wrappers legacy de `app/_actions/queries.ts` cuyo último consumer es esta ruta: `getAccountDetailAction`, `getAccountMovementsAscendingAction`, `getMovementFilterOptionsAction`, `getPendingReimbursementsAction`, `getRecurrenceLinkedTransactionIdsAction`, `getInstitutionsAction`. Quedan solo los wrappers de `/dashboard` y `/transactions/recurring` (changes posteriores).
- **Audit RLS de `institutions`**: es la única tabla del read path de esta ruta que no quedó cubierta por el audit del piloto (catálogo global). Se verifica RLS habilitado + policy de SELECT correcta; hallazgos se corrigen por migración en este mismo change.
- Los query keys (`QUERY_KEYS.accountDetail`, `accountMovementsAscending`, `accountPendingReimbursements`, `institutions`, etc.) y sus `staleTime` se conservan idénticos — cambia el transporte, no la identidad de cache.
- **Sin RPC nueva**: `getAccountMovementsAscending` sigue trayendo el historial ascendente completo porque el running balance per-row lo exige (spec `transactions`, requirement del running balance con `computeRunningBalances` client-side). Optimizar ese select queda fuera de alcance.
- El guard server-side de `page.tsx` (auth, `notFound()`, redirect a `/cards/[id]`) no cambia: sigue usando `getAccountDetail` con el server client, como norma el spec.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-data-access`: el requirement "Los reads de las rutas web van directo del browser a Supabase" se actualiza para reflejar el rollout — `/accounts/[id]` se suma a las rutas migradas (deja de estar bajo la nota "rutas existentes migran ruta por ruta") y gana su scenario de mount paralelo, simétrico al de `/transactions`. El comportamiento normado no cambia; cambia el alcance de rutas cubiertas.

## Impact

- **`apps/web`**: los 6 containers de `app/(app)/accounts/[id]/_components/` cambian imports y `queryFn`; `app/_actions/queries.ts` pierde los 6 wrappers (verificado por grep que no tienen otros consumers).
- **`supabase/migrations`**: solo si el audit de `institutions` encuentra una policy faltante o incorrecta.
- **Sin cambios** en `lib/*/queries.ts` (ya client-agnósticas), en query keys/staleTime, en mutaciones ni en `apps/mobile`.
- **Riesgo**: bajo — mismo patrón ya probado en `/transactions`; las tablas restantes del read path (transactions, accounts, categories, subcategories, recurrences, recurrence_instances) ya fueron auditadas en el piloto.
