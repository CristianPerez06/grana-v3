# Tasks: accounts-direct-reads

## 1. Audit RLS de institutions (prerequisito — ya verificado en código)

> Pre-verificado al revisar las migraciones (2026-06-14): `institutions` ya cumple el contrato del spec `web-data-access`. RLS habilitada en `0003_seed_institutions.sql:11`; SELECT policy correcta en `0020_custom_institutions.sql` (`using (user_id is null or user_id = auth.uid())` → catálogo legible por todo `authenticated`, filas custom solo por su dueño; writes scoped al owner, catálogo inmutable). El comentario de `0034_seed_banco_santa_fe.sql` lo documenta. No se espera migración.

- [x] 1.1 Confirmar que el estado del proyecto Supabase coincide con las migraciones (RLS habilitado + la SELECT policy de `0020` presente); sin aperturas mayores a las del read server-side
- [x] 1.2 No-op esperado: solo crear migración si 1.1 revela una divergencia entre el proyecto y las migraciones

## 2. Migrar los containers a reads directos

- [x] 2.1 `account-detail-header.tsx`: swap `getAccountDetailAction(accountId)` → `getAccountDetail(createClient(), accountId)` (import desde `lib/accounts/queries` y `lib/supabase/client`)
- [x] 2.2 `account-detail-content.tsx`: mismo swap de `getAccountDetailAction`
- [x] 2.3 `edit-account-drawer-loader.tsx`: swap `getAccountDetailAction` y `getInstitutionsAction` → `getAccountDetail` / `getInstitutions` directas; verificar que el gating del botón Editar (disabled hasta resolver ambas, fallback `<a href>` a `/edit`) queda intacto
- [x] 2.4 `movement-list-account-container.tsx`: swap `getAccountMovementsAscendingAction`, `getAccountDetailAction`, `getRecurrenceLinkedTransactionIdsAction` → queries directas (`lib/transactions/queries`, `lib/accounts/queries`, `lib/recurrences/queries`)
- [x] 2.5 `movement-filters-account-container.tsx`: swap `getMovementFilterOptionsAction` y `getAccountMovementsAscendingAction` → queries directas
- [x] 2.6 `pending-reimbursements-account-container.tsx`: swap `getPendingReimbursementsAction(accountId)` → `getPendingReimbursements(createClient(), accountId)`
- [x] 2.7 Verificar que ningún query key ni `staleTime` cambió en los swaps (diff acotado a imports y `queryFn`)

## 3. Eliminar los wrappers legacy

- [x] 3.1 Borrar de `app/_actions/queries.ts` los 6 wrappers: `getAccountDetailAction`, `getAccountMovementsAscendingAction`, `getMovementFilterOptionsAction`, `getPendingReimbursementsAction`, `getRecurrenceLinkedTransactionIdsAction`, `getInstitutionsAction`
- [x] 3.2 Actualizar el comentario header del archivo: rutas pendientes quedan solo `/dashboard` y `/transactions/recurring`
- [x] 3.3 Grep final de los 6 nombres en `apps/web/` para confirmar cero referencias residuales

## 4. Verificación

- [x] 4.1 `pnpm lint` y `pnpm typecheck` en verde
- [x] 4.2 Smoke test de `/accounts/[id]` con la app corriendo: hero card con balances, running balance per-row con fila "Saldo inicial", filtros + navegación de mes, pending reimbursements, botón Editar disabled → enabled y drawer con instituciones — verificado manualmente por el usuario
- [x] 4.3 Verificar en el network tab que el mount dispara las queries como requests concurrentes browser → Supabase (sin cola de server actions) y que ninguna request va a `auth/v1/user` — verificado manualmente por el usuario
- [x] 4.4 Smoke test de no-regresión: `/accounts` (lista), guard de cuenta inexistente (404) y redirect de cuenta credit a `/cards/[id]` — verificado manualmente por el usuario
