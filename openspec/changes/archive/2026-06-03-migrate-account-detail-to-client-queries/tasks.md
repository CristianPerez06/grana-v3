## 1. Setup y dependencias

- [x] 1.1 Verificar que `AppQueryProvider` ya está montado en `(app)/layout.tsx` (debería estar — fue puesto en el change anterior); confirmar que cubre `/accounts/[id]`
- [x] 1.2 Confirmar que el reducer + context de filtros (`filters-state.ts` + `filters-context.tsx`) son importables desde `/accounts/[id]` sin fricción de paths; si el `FiltersProvider` vive bajo `app/(app)/transactions/_components/`, relocalizarlo a un módulo neutro reusable (ej. `apps/web/lib/transactions/components/filters-provider.tsx`) y actualizar el import en `/transactions` — relocado a `apps/web/lib/transactions/filters-context.tsx`; 4 imports actualizados; typecheck verde

## 2. Capa de queries (server actions wrappers)

- [x] 2.1 ~~Crear nueva query `getAccountMovementsPage`~~ — **Decisión revisada en implementación:** el `page.tsx` actual ya hace el filtering+slice in-memory después de fetchear toda la historia, así que no hace falta una query nueva server-side. El container client-side aplica los mismos filtros sobre el dataset ascendente que ya carga para el running balance, evitando duplicar fetching. Actualizado design (D4/D5 ya contemplaba esta alternativa como trade-off; ahora es la decisión final)
- [x] 2.2 Renombrar `getAccountMovements` → `getAccountMovementsAscending`. Único callsite externo (`page.tsx`) se arregla en group 8 con el rewrite
- [x] 2.3 Agregar a `apps/web/app/_actions/queries.ts` los wrappers `'use server'`:
  - `getAccountDetailAction(id)` ✓
  - `getAccountMovementsAscendingAction(accountId)` ✓
  - `getInstitutionsAction()` ✓
  - `getPendingReimbursementsForAccountAction(accountId)` — ya existe como `getPendingReimbursementsAction(accountId?)`, reuso ✓
- [x] 2.4 ~~Tests unitarios para `getAccountMovementsPage`~~ — N/A (no hay query nueva). El filtering pure-function client-side se cubre por smoke tests; el reducer ya tiene su propia cobertura

## 3. Query keys

- [x] 3.1 Agregar a `lib/transactions/query-keys.ts`:
  - `QUERY_KEYS.accountDetail(accountId)` ✓
  - `QUERY_KEYS.accountMovementsAscending(accountId)` ✓
  - `QUERY_KEYS.accountPendingReimbursements(accountId)` ✓ (path `['reimbursements','pending','account',accountId]` para no chocar con la key global de pending reimbursements)
  - `QUERY_KEYS.institutions` ✓
  - ~~`accountMovementsPage`~~ — N/A (filtering+slice client-side sobre `accountMovementsAscending`)
- [x] 3.2 Configurar `staleTime` por key en `createQueryClient`:
  - `institutions`: 15min ✓
  - `accountDetail`, `accountMovementsAscending`, `accountPendingReimbursements`: heredan el default global (0; refetch on mount; invalidación explícita en cada mutación)

## 4. Estado de filtros para /accounts/[id]

- [x] 4.1 Reusar el reducer existente: el shell de `/accounts/[id]` monta `<FiltersProvider>` (default initial state via `createInitialFilters()`, ya prevé `accountId: null`)
- [x] 4.2 `MovementFiltersAccountContainer` pasará `showAccountFilter={false}` (ya soportado por `MovementFilters`); no requiere modificar el reducer ni la query de filter-options

## 5. Containers cliente para /accounts/[id]

- [x] 5.1 Crear `apps/web/app/(app)/accounts/[id]/_components/movement-filters-account-container.tsx`: cliente container que llama `getMovementFilterOptionsAction()`, lee filtros del context, dispatcha al reducer; renderiza `<MovementFilters showAccountFilter={false} ... />`
- [x] 5.2 Crear `movement-list-account-container.tsx`:
  - `useQueries` para `getAccountMovementsAscendingAction` + `getAccountDetailAction` (running balance source + initial balances)
  - `useQuery` para `getRecurrenceLinkedTransactionIdsAction(movementIds)` (chained con `enabled`)
  - `computeRunningBalances` memoizado client-side
  - Filtering + slice client-side (`applyAccountFilters` + `slice(0, limit)`); `runningBalances` se pasa null cuando hay content filters activos
  - Empty state con `onClear` callbacks; `onAdd` → link `/transactions/new?account=${id}&from=account:${id}` (no drawer en este route)
  - Load-more dispatch `incrementLimit`
- [x] 5.3 Crear `pending-reimbursements-account-container.tsx`: wrapper con `useQuery` scoped por `accountId`, computa `todayISO` client-side, renderiza `<PendingReimbursementsBlock />`

## 6. Header con drawer readiness

- [x] 6.1 Refactorizar `account-detail-header.tsx`:
  - Cambia signature: solo `accountId` como prop
  - `useQuery` para `accountDetail` (balances con skeleton mientras pending)
  - Avatar + nombre + back link con skeleton hasta que `account` resuelve (mismo shape para evitar layout jolt)
  - Botón "Editar" usa `useEditAccountDrawer()`: si el provider está montado (drawer loader resolvió `account+institutions`), abre drawer; si no, cae al `<a href="/accounts/[id]/edit">` (fallback no-JS preservado)
  - Botones archive/reactivate/delete: skeleton de 14px mientras la query del historial está pending; al resolver decide entre archive (has tx) vs delete (no tx) vs reactivate (archivada)
- [x] 6.2 `hasTransactions` se lee via `useQuery` sobre `accountMovementsAscending` (dedupe automático con el list container — TanStack une por queryKey, no duplica fetch)

## 7. EditAccountDrawerProvider hidratado por TanStack

- [x] 7.1 Crear `edit-account-drawer-loader.tsx` con `useQueries` para `account` + `institutions`; cuando ambos resuelven monta `<EditAccountDrawerProvider>`, sino renderiza children directos
- [x] 7.2 `EditAccountDrawerProvider` removido del `page.tsx`; ahora se monta vía loader adentro del `<AccountDetailShell>`

## 8. Shell de la ruta

- [x] 8.1 `page.tsx` reducido a ~25 líneas (auth + getAccountDetail + notFound/redirect + monta shell)
- [x] 8.2 `account-detail-shell.tsx` creado con `<FiltersProvider>` + `<EditAccountDrawerLoader>` + `<AccountDetailContent>`
- [x] 8.3 `account-detail-content.tsx` creado: back link estático, header, pending reimbursements scoped, link "agregar moneda" condicional (lee account del cache), section title + CTA, filtros + lista

## 9. Eliminar URL-mode de MovementFilters y MovementList

- [x] 9.1 `movement-filters.tsx`: eliminado `setParamsUrl`, ramas URL fallback, imports `useRouter/useSearchParams/usePathname`. `controller` ahora required
- [x] 9.2 `movement-list.tsx`: eliminado `emptyState.clearHref` (no más callers post-migración). `addHref` preservado porque ambos rutas lo usan como fallback no-drawer (link a `/transactions/new`). `Link` import sigue en uso para detail nav de filas
- [x] 9.3 `pnpm typecheck` verde

## 10. Cleanup de lib/transactions/filters.ts

- [x] 10.1 Eliminado de `filters.ts`:
  - `parseMovementFilters`, `buildClearedHref`, `buildFiltersClearedHref`, `buildSearchClearedHref`
  - `hasContentFilters`, `hasSearch`, `hasOtherContentFilters`
  - `resolveEmptyVariant`, `MovementEmptyVariant` type
  - constantes `FILTER_PARAM_KEYS`, `CONTENT_FILTER_PARAM_KEYS`
  - **Corrección:** `movementMatchesText` se mantiene — sigue siendo usado por `getGlobalMovementsPage` (server-side) y por el nuevo `MovementListAccountContainer` (client-side filtering). El design lo marcaba para borrar pero la auditoría reveló dos consumers vivos
- [x] 10.2 `filters.test.ts` reescrito conservando los tests vivos (`monthOf`, `shiftMonth`, `resolveMonthRange`, `movementMatchesText`). Bloques de parseMovementFilters/buildClearedHref/resolveEmptyVariant eliminados (~150 líneas)
- [x] 10.3 Imports remanentes auditados: `MovementFilters` type (queries.ts, query-keys.ts, _actions/queries.ts), `SUBCATEGORY_NONE_MARKER` (dashboard/category-teaser, overview-container, movement-filters component, movement-list-account-container, queries.ts), `monthOf/shiftMonth` (filters-state.ts, dashboard, movement-filters), `MOVEMENT_TYPE_KEYS/MovementTypeFilter/MovementCurrencyFilter` (movement-filters, filters-state), constantes de limit (filters-state, queries), `resolveMonthRange` (queries, dashboard, filters.test). Todos vivos
- [x] 10.4 `pnpm typecheck` + `pnpm lint` verdes; 339 tests pasan

## 11. Helpers de invalidación

- [x] 11.1 Agregado `invalidateAfterAccountMutation(qc)` a `lib/transactions/invalidation.ts`: invalida `['account','detail']` (prefijo), `['accounts','list']`, `['institutions']`
- [x] 11.2 **Decisión:** extender `invalidateAfterMovementMutation` para que invalide automáticamente las keys account-scoped (`['account','detail']`, `['account','movements-ascending']`, `['reimbursements','pending','account']`) por prefijo — no requiere `accountId` específico, refresca todos los account-detail snapshots cacheados. Igual treatment a `invalidateAfterReimbursementMutation`. Esto elimina la posibilidad de olvidar el accountId al invalidar
- [x] 11.3 Callsites auditados: el header del shell (archive/reactivate/delete) ahora llama `invalidateAfterAccountMutation`. `edit-account-form.tsx` (drawer + página fallback) también lo llama post-save. Mutations de movement disparadas desde el drawer global o desde el row del list pasan por `invalidateAfterMovementMutation` que ya incluye las keys account-scoped

## 12. Helpers de revalidatePath (server)

- [x] 12.1 Auditoría: cada action llamaba `revalidatePath('/accounts')` **sin** `'layout'` flag, lo cual NO invalidaba `/accounts/[id]` (segment-only). Gap real, no solo cosmético
- [x] 12.2 Helper `revalidateAfterAccountMutation()` agregado a `_actions/_helpers.ts` (`/accounts` layout + `/cards` layout + `/dashboard`). 7 callsites en `_actions/accounts.ts` migrados (createAccount, updateAccount, archiveAccount, reactivateAccount, deleteAccount, addCurrencyToAccount, deactivateCurrencyFromAccount). Import directo de `revalidatePath` removido del file
- [x] 12.3 `revalidateAfterMovementMutation()` en `_helpers.ts` ya hace `revalidatePath('/accounts', 'layout')` (verificado en código existente) — todas las server actions de movement lo llaman, cubierto

## 13. Verificación cross-route y smoke test manual

- [x] 13.1 Auditado: 5 hrefs a `/accounts/` en el repo (account-row, empty-accounts-state, account-detail-content, account-detail-header). Ninguno usa query params — todos navegan a `/accounts/[id]` o `/accounts/[id]/edit` o `/accounts/new` sin search
- [x] 13.2–13.20 Smoke tests validados por usuario: header con skeleton, drawer-ready, fallback link, empty states + running balance, filtros + clear, month nav sin URL change, F5 reset, load-more, drill subcategoría, mutations refrescan header+lista+balance, archive/reactivate/delete, currency add/deactivate, reembolso confirm/cancel, cross-route a /dashboard, redirect a /cards, 404 server-side

## 14. Lint, typecheck, tests

- [x] 14.1 `pnpm typecheck` verde
- [x] 14.2 `pnpm lint` verde
- [x] 14.3 Reducer tests siguen pasando (22 tests, sin cambios)
- [x] 14.4 ~~Tests de `getAccountMovementsPage`~~ — N/A (no hay query nueva server-side)
- [x] 14.5 `filters.test.ts` limpio: 7 tests vivos (resolveMonthRange × 2, shiftMonth × 2, monthOf, movementMatchesText × 2)
- [x] 14.6 Cleanup: `useRouter`/`useSearchParams`/`usePathname` eliminados de `movement-filters.tsx`; `revalidatePath` import directo removido de `accounts.ts`; tests dead-code removidos (~150 líneas en `filters.test.ts`)

## 15. Documentación y archivo

- [x] 15.1 `AGENTS.md` "Route rendering model" actualizado: `/accounts/[id]` agregada como reference implementation; "account detail" removida de la lista RSC; aclaración sobre page.tsx + terminal guards + ubicación canónica del `FiltersProvider`
- [x] 15.2 Comentario marcador en `lib/transactions/invalidation.ts` actualizado: ya no referencia "group 9 of the migration"; ahora menciona ambos client routes (/transactions, /accounts/[id])
- [ ] 15.3 PR — usuario decide si abrir PR formal o merge directo a main (ver memoria de workflow)
- [ ] 15.4 Archivar el change con `/opsx:archive` post-merge (lo dispara el usuario)
