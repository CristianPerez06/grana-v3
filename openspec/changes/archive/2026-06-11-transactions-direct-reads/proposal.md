# Proposal: transactions-direct-reads

## Why

`/transactions` tarda segundos en cargar y el resto de las rutas comparte el mismo síntoma. La causa es arquitectural, no de SQL: el mount dispara ~12 server actions como `queryFn` de TanStack Query, y React **serializa** las server actions por cliente — el tiempo de carga es la *suma* de todas las requests, no el máximo. Cada action paga además dos `auth.getUser()` de red (proxy + helper), la action principal corre un write (`generateDueRecurrenceInstances`) antes del read del listado, y `getGlobalMovementsPage` over-fetchea chunks de 200 filas filtrando type/texto/monto en JS. Con RTT medido de ~50ms a Supabase, son ~40–50 roundtrips secuenciales ≈ 2–2.5s de red pura en cada carga fría.

## What Changes

- **Nueva arquitectura de lectura para `apps/web`**: los reads salen del path de server actions y van directo browser → Supabase (PostgREST) vía TanStack Query, con query functions que reciben el client inyectado (el patrón ya existente en `@grana/dashboard`). Las requests pasan a ser genuinamente paralelas y desaparecen los dos `getUser()` de red por request (el JWT viaja en el header; RLS resuelve `auth.uid()`).
- **Las mutaciones quedan como server actions** — la serialización de React es aceptable (y deseable) para writes; `revalidatePath` y la invalidación TanStack no cambian.
- **La página de movimientos se convierte en una función RPC de Postgres** con los filtros (type, texto, monto, cuenta) empujados a SQL: mata el loop de chunks, el over-fetch de 200 filas y el workaround `attachLinkedExpenses` del self-FK (la RPC devuelve el linked expense embebido).
- **`generateDueRecurrenceInstances` sale del read path**: deja de bloquear la query del listado y pasa a dispararse fire-and-forget en el mount (server action de mutación separada). pg_cron queda anotado como evolución futura.
- **Validación local del JWT en `proxy.ts`** (claims) en lugar de `auth.getUser()` de red en cada request — beneficia a todas las rutas, no solo a la piloto.
- **Audit de RLS como prerequisito**: las tablas leídas desde el browser (transactions, accounts, categories, subcategories, recurrences, recurrence_instances, recurrence_suggestion_dismissals, period_payments, card_periods, household y relacionadas) pasan a tener RLS como única frontera de autorización en web — igual que ya ocurre en mobile.
- **La sugerencia de recurrencia se difiere post-paint** con `staleTime` largo: deja de competir con las queries críticas del mount.
- **Alcance piloto**: solo `/transactions` migra en este change. `/dashboard`, `/accounts`, `/cards` y demás rutas siguen el patrón establecido en changes posteriores.

## Capabilities

### New Capabilities

- `web-data-access`: arquitectura del read path de `apps/web` — reads directos browser → Supabase con query functions client-inyectadas compartibles, RPCs de Postgres para reads compuestos/calientes, mutaciones como server actions, RLS como frontera de autorización de los reads, validación local de sesión en el proxy, y la regla de que ningún write bloquea el read path.

### Modified Capabilities

- `transactions`: los requirements que referencian "el server action" para el recurrence-link lookup del listado (exclusión de la fila sintética "Saldo inicial") se reformulan en términos de la query directa — el comportamiento (excluir ids sintéticos del input) no cambia, cambia el mecanismo nombrado.

## Impact

- **`apps/web`**: containers de `/transactions` (`_components/*-container.tsx`) cambian sus `queryFn` de actions a query functions client; `lib/transactions/queries.ts` se refactoriza para recibir el client inyectado; `app/_actions/queries.ts` pierde los wrappers de lectura de la ruta piloto; `proxy.ts` pasa a validación local de claims; `lib/supabase/client.ts` pasa a ser el client de datos del browser.
- **`supabase/migrations`**: nueva migración con la(s) función(es) RPC de la página de movimientos; correcciones de policies que surjan del audit de RLS.
- **`packages`**: las query functions migradas quedan client-agnósticas (firma `(supabase, …)`) para su futura extracción/consumo desde mobile — la extracción a package es opcional y no bloquea este change.
- **`apps/mobile`**: sin cambios; converge a futuro consumiendo las mismas query functions.
- **Riesgo principal**: RLS pasa de defensa en profundidad a única defensa para los reads web — mitigado por el audit previo y por el hecho de que mobile ya opera bajo ese contrato.
