# Design: accounts-direct-reads

## Context

`/accounts/[id]` ya tiene la arquitectura de UI objetivo: `page.tsx` server-side solo con guards terminales, shell client con `FiltersProvider`, secciones que fetchean independientemente vía TanStack Query con keys centralizados (`QUERY_KEYS.accountDetail`, `accountMovementsAscending`, `accountPendingReimbursements`, `institutions`, `movementFilterOptions`, `recurrenceLinkedTransactionIds`). Lo único legacy es el **transporte**: los `queryFn` invocan server actions (`app/_actions/queries.ts:1-95`), que React serializa por cliente. Las query functions subyacentes (`lib/accounts/queries.ts`, `lib/transactions/queries.ts`, `lib/recurrences/queries.ts`) ya son client-agnósticas (`(supabase: DbClient, …)`), y `/transactions` ya demuestra el patrón destino: `queryFn: () => getX(createClient(), …)` (ver `app/(app)/transactions/_components/movement-list-container.tsx:50-81`).

Consumers actuales de los 6 wrappers a eliminar (verificado por grep): solo los 6 containers de `app/(app)/accounts/[id]/_components/`. Los wrappers restantes de `app/_actions/queries.ts` (`getMonthCategoryBreakdownAction` → `/dashboard`; `getAccountsAction`, `getAllCategoriesAction` → `/transactions/recurring`) quedan para sus changes respectivos.

## Goals / Non-Goals

**Goals:**

- Mount de `/accounts/[id]` con requests genuinamente paralelas browser → Supabase: tiempo de datos gobernado por la cadena más lenta, no por la suma.
- Eliminar los 6 wrappers de lectura cuyo último consumer es esta ruta, acercando `app/_actions/queries.ts` a su extinción.
- Cerrar el gap de audit RLS: `institutions` es la única tabla nueva del read path de esta ruta no cubierta por el audit del piloto.

**Non-Goals:**

- Optimizar `getAccountMovementsAscending` (select pesado, historial completo): el running balance per-row exige el historial ascendente completo (spec `transactions`, requirement del running balance) y una RPC/paginación es otro change si alguna vez duele.
- Tocar mutaciones, invalidación, query keys, `staleTime`, o el guard server-side de `page.tsx`.
- Migrar `/dashboard`, `/transactions/recurring` o `/cards` (backlog propio).

## Decisions

### D1 — Swap mecánico de `queryFn`, sin refactor de componentes

Cada container reemplaza `getXxxAction(args)` por `getXxx(createClient(), args)` importando la query function desde `lib/<feature>/queries.ts` y el client desde `lib/supabase/client.ts`. Nada más cambia: ni keys, ni `staleTime`, ni estructura de componentes, ni el shape de los datos (las actions eran wrappers transparentes). Alternativa descartada: aprovechar para consolidar las 3 lecturas duplicadas de `accountDetail` en un hook — innecesario, TanStack ya dedupe por key; sería refactor sin requirement.

### D2 — Borrar los 6 wrappers en el mismo change

`getAccountDetailAction`, `getAccountMovementsAscendingAction`, `getMovementFilterOptionsAction`, `getPendingReimbursementsAction`, `getRecurrenceLinkedTransactionIdsAction`, `getInstitutionsAction` se eliminan de `app/_actions/queries.ts`, y el comentario del archivo se actualiza para listar solo `/dashboard` y `/transactions/recurring` como rutas pendientes. El contrato del archivo ("cada wrapper se borra cuando migra su último consumer") está escrito en el propio header del archivo y en AGENTS.md. Dejarlos "por las dudas" recrearía el riesgo de nuevos consumers.

### D3 — Audit RLS de `institutions` (pre-verificado en código; no se espera migración)

`institutions` es un catálogo global + filas custom user-scoped. Al revisar las migraciones (2026-06-14) se confirmó que ya cumple el contrato: RLS habilitada en `0003_seed_institutions.sql:11`, y SELECT policy correcta en `0020_custom_institutions.sql` (`using (user_id is null or user_id = auth.uid())` → catálogo legible por todo `authenticated`, filas custom solo por su dueño; INSERT/UPDATE/DELETE scoped al owner, catálogo inmutable). El comentario de `0034_seed_banco_santa_fe.sql` lo documenta. No hay apertura mayor que la del read server-side, así que el requirement "RLS es la frontera de autorización de los reads web" ya se satisface y no se espera migración. Las demás tablas del read path (transactions, accounts, categories, subcategories, recurrences, recurrence_instances) ya fueron auditadas en el piloto.

### D4 — `attachLinkedExpenses` corre en el browser tal cual

`getAccountMovementsAscending` encadena un segundo query (`attachLinkedExpenses`) para los linked expenses de reimbursements. Desde el browser sigue siendo una cadena secuencial de 2 roundtrips, pero corre en paralelo con las demás queries del mount — el costo es idéntico al que pagaba server-side y no bloquea a nadie. Empujarlo a una RPC es la misma optimización descartada en Non-Goals.

## Risks / Trade-offs

- **[`institutions` sin policy de SELECT]** → ya descartado: RLS + SELECT policy verificadas en `0003`/`0020` (ver D3). La task 1 queda como confirmación del proyecto vs. migraciones; si hubiera divergencia, la sección del drawer de edición quedaría sin catálogo — detectable de inmediato en smoke test (drawer no habilita).
- **[Regresión de gating del header]** → el botón Editar del hero gatea sobre `accountDetail` + `institutions` (spec `transactions`, requirement del header de `/accounts/[id]`). El swap no toca el gating, pero el smoke test debe verificar disabled → enabled y el fallback `<a href>` intacto.
- **[Datos visibles solo vía RLS]** → mismo trade-off ya aceptado y documentado en el piloto; esta ruta no agrega tablas user-scoped nuevas.

## Migration Plan

Sin deploy especial: cambio de código puro (+ posible migración de policy). Rollback = revert del commit. Las rutas conviven: `/accounts/[id]` migra completa en un solo change, no hay estado intermedio.

## Open Questions

(ninguna)
