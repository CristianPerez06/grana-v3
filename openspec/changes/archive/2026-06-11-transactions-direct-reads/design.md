# Design: transactions-direct-reads

## Context

`/transactions` es un shell client (Variant C de `route-loading-and-errors`) donde cada sección fetchea con TanStack Query. Hoy todos los `queryFn` son server actions (`app/_actions/queries.ts`), y React serializa las server actions por cliente: el mount encola ~12 POSTs secuenciales. Cada POST paga `auth.getUser()` de red dos veces (en `proxy.ts` y en `getAuthenticatedUserId()`), la action del listado corre `generateDueRecurrenceInstances()` (write) antes del read, y `getGlobalMovementsPage` filtra type/texto/monto en JS sobre chunks de 200 filas con un roundtrip extra (`attachLinkedExpenses`) por chunk.

Datos medidos / verificados durante la exploración:

- RTT a PostgREST del proyecto: ~45–50ms (warm). El problema es la *cantidad serializada* de roundtrips, no la distancia ni Postgres.
- Mobile ya consulta Supabase directo desde el device (`apps/mobile/lib/supabase.ts` + TanStack), por lo que RLS ya es la frontera de autorización real del producto.
- El patrón "query function con client inyectado" ya existe: `getMonthCategoryBreakdownShared(supabase, month)` en `@grana/dashboard`.
- `transactions` tiene policies owner-only desde la migración 0008 y lectura por household desde 0023.
- Los `staleTime` por familia ya están centralizados en `lib/query-client.ts` (`setQueryDefaults` por prefijo de query key).

## Goals / Non-Goals

**Goals:**

- Eliminar la serialización del mount de `/transactions`: reads directos browser → Supabase, genuinamente paralelos.
- Eliminar el overhead fijo de auth por request de datos (doble `getUser()` de red).
- Llevar el filtrado de movimientos a SQL (RPC) y eliminar el loop de chunks + `attachLinkedExpenses`.
- Sacar el write (`generateDueRecurrenceInstances`) del read path.
- Dejar las query functions migradas con firma client-agnóstica `(supabase, …)` para su futura reutilización desde mobile.
- Establecer el patrón (capability `web-data-access`) que las demás rutas seguirán en changes posteriores.

**Non-Goals:**

- Migrar otras rutas (`/dashboard`, `/accounts`, `/cards`, settings) — siguen el patrón en changes futuros.
- Extraer las query functions a un package compartido — la firma queda lista, la extracción se decide cuando mobile la necesite (mismo criterio que `@grana/movement-form`).
- Cambiar el modelo de mutaciones (server actions + `revalidatePath` + invalidación TanStack quedan como están).
- pg_cron para la generación de instancias — se documenta como evolución; el interim es fire-and-forget.
- Realtime / optimistic updates.

## Decisions

### D1 — Reads directos browser → Supabase con query functions client-inyectadas

Los containers de `/transactions` cambian su `queryFn` de server action a una llamada directa con el browser client (`lib/supabase/client.ts`, `createBrowserClient` de `@supabase/ssr` — comparte la sesión por cookies con el server). Las funciones de `lib/transactions/queries.ts` y `lib/recurrences/queries.ts` que la ruta usa pasan de `const supabase = await createClient()` interno a recibir `supabase` como primer parámetro (el patrón `@grana/dashboard`). Los query keys y `staleTime` existentes no cambian: solo cambia el transporte.

*Alternativas consideradas*: route handlers GET (paraleliza pero mantiene el doble hop y duplica la capa para mobile); action compuesta única (rompe la granularidad de cache/invalidación por familia y sigue encolándose detrás de mutaciones). Descartadas en la exploración — ver historia del change.

### D2 — La página de movimientos es una función RPC de Postgres

`getGlobalMovementsPage` se reemplaza por una función SQL `get_movements_page(p_filters jsonb, p_limit int, p_offset int)` (`SECURITY INVOKER`, así RLS aplica intacta) que:

- aplica **todos** los filtros en SQL: rango de fechas/mes, categoría, subcategoría (incl. marker "sin subcategoría"), moneda, cuenta (incluyendo la lógica de parents con hijos en la cuenta y card payments vía `period_payments`), tipo funcional, texto (`ilike` sobre descripción y campos relacionados) y rango de montos;
- excluye reimbursements no recibidos/cancelados (la regla `isHistoryRow`) en SQL;
- devuelve las filas con sus embeds (categoría, subcategoría, cuentas, period payment) **y el linked expense del reimbursement resuelto en el mismo query** — el self-join que PostgREST no puede embeber es un `LEFT JOIN` trivial en SQL, lo que elimina `attachLinkedExpenses`;
- trae `limit + 1` filas para derivar `hasMore` sin count ni loop.

El mapeo a `FinancialMovement` (`toFinancialMovement`) queda en TS, idéntico para web y futuro mobile.

*Alternativa considerada*: mantener PostgREST con los filtros que sí soporta y aceptar el filtro de texto en JS — rechazada: el loop de chunks reaparece con cualquier filtro no-SQL y el self-FK seguiría costando un roundtrip extra.

### D3 — Validación local de sesión en el proxy (claims), `getUser()` de red solo donde importa

`proxy.ts` pasa de `supabase.auth.getUser()` (roundtrip al Auth server en cada request) a `supabase.auth.getClaims()` con verificación local de firma. **Prerequisito**: el proyecto debe usar signing keys asimétricas (los proyectos con JWT secret legacy HS256 hacen fallback a red); verificar en el dashboard y rotar a ECC/RSA si hace falta — es un toggle sin downtime en Supabase. El helper `getAuthenticatedUserId()` de las actions de mutación adopta el mismo mecanismo.

Trade-off aceptado: una sesión revocada sigue siendo válida hasta la expiración del access token (TTL ~1h). Para los reads el punto es moot (RLS valida el JWT en cada query igual); para mutaciones el riesgo es equivalente al que mobile ya corre.

### D4 — `generateDueRecurrenceInstances` se dispara fire-and-forget en el mount

Deja de vivir dentro de `getMovementsPageAction`. Pasa a ser una server action de mutación invocada una vez por mount de `/transactions` (efecto en el shell, sin `await` que bloquee ninguna query). Si reporta `created > 0`, invalida las queries de pending recurrences y movements para que la instancia nueva aparezca sin reload. La semántica visible no cambia ("las instancias debidas se materializan cuando el usuario entra"); pg_cron queda documentado como evolución para materializarlas aunque el usuario no entre.

### D5 — La sugerencia de recurrencia se difiere y cachea

`getTopRecurrenceSuggestion` (4–5 queries, detección sobre 6 meses) migra a query directa client-inyectada como las demás, pero con `staleTime` largo (≥30 min) — el cómputo es estable dentro de una sesión. Al salir de la cola de actions ya no bloquea a nadie; el `staleTime` evita recomputarla en cada navegación. Colapsarla a RPC queda fuera de alcance (no está en el camino crítico).

### D6 — El audit de RLS es un entregable del change, previo a la migración de containers

Pasada tabla por tabla sobre todo lo que la ruta lee desde el browser: `transactions`, `accounts`, `categories`, `subcategories`, `recurrences`, `recurrence_instances`, `recurrence_suggestion_dismissals`, `period_payments`, `card_periods`, `household` / `household_member`. Para cada una: RLS habilitado, policy de SELECT correcta (owner u household según el dominio), y verificación de que ninguna policy abre más de lo que el server abría. Los hallazgos se corrigen por migración en este mismo change. El resultado queda documentado (qué se auditó y con qué criterio) para que los changes de las próximas rutas solo auditen sus tablas nuevas.

### D7 — Los wrappers de actions de lectura se eliminan al final, no al principio

Durante la migración los containers se van moviendo a las queries directas; los wrappers en `app/_actions/queries.ts` que queden sin consumers se borran en la tarea de cleanup. Eso da rollback trivial por container (volver a apuntar el `queryFn` al wrapper) mientras dura la implementación.

## Risks / Trade-offs

- **[RLS como única frontera de los reads web]** Un hueco de policy pasa de "mitigado por el server" a directamente explotable. → Mitigación: D6 como prerequisito bloqueante; mobile ya opera bajo este contrato, así que el audit beneficia a todo el producto.
- **[`getClaims()` con secret simétrico hace fallback a red]** El win de D3 desaparece silenciosamente. → Mitigación: verificar el signing key del proyecto como primera tarea de D3; rotar a asimétrico si hace falta.
- **[La RPC concentra lógica en SQL]** El filtrado deja de estar en TS testeable con Vitest. → Mitigación: la función SQL se cubre con los tests de integración existentes del listado (los unit tests de `filters.ts` que aplican siguen válidos para la UI); el contrato de la RPC queda specceado en `web-data-access` y el mapeo TS (`toFinancialMovement`) no cambia.
- **[Sesión revocada válida hasta expirar el token]** (D3) → Aceptado: TTL corto (~1h), producto single-user-por-cuenta, mismo contrato que mobile.
- **[Query functions en el bundle del browser]** Lógica de queries visible client-side. → Aceptado: no hay secretos en ellas (RLS protege los datos); el peso es marginal.
- **[Divergencia temporal entre rutas]** Hasta que las demás rutas migren, conviven dos patrones de read. → Mitigación: la capability `web-data-access` documenta el patrón canónico y marca el viejo como legacy; el slicing por ruta es deliberado para mantener PRs revisables.

## Migration Plan

1. **Fundación** (sin tocar UI): audit RLS + migración de policies faltantes; verificación/rotación del signing key; proxy a `getClaims()`.
2. **RPC**: migración SQL de `get_movements_page` + función TS client-agnóstica que la llama + tests.
3. **Containers**: migrar los `queryFn` de `/transactions` container por container (la app sigue funcionando en cada paso; rollback = revertir el container).
4. **Read path limpio**: sacar `generateDueRecurrenceInstances` del action de lectura (D4), diferir la sugerencia (D5).
5. **Cleanup**: borrar los wrappers de lectura sin consumers en `app/_actions/queries.ts` y el código muerto de `getGlobalMovementsPage` (loop de chunks, `attachLinkedExpenses` para el listado global).

Rollback global: revertir el merge de la rama; no hay migración destructiva (la RPC y las policies nuevas son aditivas).

## Open Questions

- **Algoritmo de firma del JWT del proyecto**: ¿ya es asimétrico (proyectos nuevos post-2025 lo son por default) o usa el secret legacy? Determina si D3 es un cambio de código o también un toggle en el dashboard. Se resuelve en la primera tarea.
- **Texto de búsqueda en la RPC**: `ilike` simple sobre descripción + nombres relacionados alcanza para el volumen actual; ¿vale la pena FTS (`tsvector`)? Default: `ilike`, FTS solo si la búsqueda se siente lenta con datos reales.
